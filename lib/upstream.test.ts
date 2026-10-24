// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cached, resetCache, trackerFetch, UpstreamError } from "@/lib/upstream";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

beforeEach(() => {
  resetCache();
  process.env.SOLANA_TRACKER_API_KEY = "test-key";
  delete process.env.SOLANA_TRACKER_BASE_URL;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("trackerFetch", () => {
  it("calls the provider with the API key and returns parsed JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(trackerFetch("/tokens/x")).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://data.solanatracker.io/tokens/x");
    expect(init.headers["x-api-key"]).toBe("test-key");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("honours a configurable base URL", async () => {
    process.env.SOLANA_TRACKER_BASE_URL = "http://localhost:4010/";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    await trackerFetch("/a");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:4010/a");
  });

  it("fails with 503 (and never calls out) when no API key is configured", async () => {
    delete process.env.SOLANA_TRACKER_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(trackerFetch("/a")).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [404, 404],
    [400, 404],
    [401, 502],
    [403, 502],
    [500, 502],
    [503, 502],
  ])("maps provider %i to our %i", async (upstream, ours) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: upstream })));
    await expect(trackerFetch("/a")).rejects.toMatchObject({ status: ours });
  });

  it("maps 429 to 429 and carries Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("slow down", { status: 429, headers: { "retry-after": "12" } }))
    );
    await expect(trackerFetch("/a")).rejects.toMatchObject({ status: 429, retryAfterSeconds: 12 });
  });

  it("never leaks the provider's raw error text to callers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "internal secret: key abc123 invalid" }), { status: 401 })
      )
    );
    const error = await trackerFetch("/a").catch((e: UpstreamError) => e);
    expect((error as UpstreamError).message).not.toMatch(/secret|abc123/);
  });

  it("turns a timeout into 504 and a network failure into 502", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    await expect(trackerFetch("/a")).rejects.toMatchObject({ status: 504 });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(trackerFetch("/a")).rejects.toMatchObject({ status: 502 });
  });

  it("turns a non-JSON 200 into 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })));
    await expect(trackerFetch("/a")).rejects.toMatchObject({ status: 502 });
  });
});

describe("cached", () => {
  it("serves repeat calls from cache within the TTL", async () => {
    const load = vi.fn().mockResolvedValue("v1");
    const first = await cached("k", 60, load);
    const second = await cached("k", 60, load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(first.status).toBe("MISS");
    expect(second).toMatchObject({ status: "HIT", value: "v1", fetchedAt: first.fetchedAt });
  });

  it("reloads after the TTL expires", async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValueOnce("v1").mockResolvedValueOnce("v2");
    await cached("k", 60, load);
    vi.advanceTimersByTime(61_000);
    const second = await cached("k", 60, load);
    expect(load).toHaveBeenCalledTimes(2);
    expect(second).toMatchObject({ status: "MISS", value: "v2" });
  });

  it("shares one in-flight request between concurrent callers", async () => {
    let resolve!: (v: string) => void;
    const load = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const a = cached("k", 60, load);
    const b = cached("k", 60, load);
    resolve("shared");
    await expect(Promise.all([a, b])).resolves.toMatchObject([{ value: "shared" }, { value: "shared" }]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves stale data when the provider fails (stale-if-error)", async () => {
    vi.useFakeTimers();
    const load = vi
      .fn()
      .mockResolvedValueOnce("good")
      .mockRejectedValueOnce(new UpstreamError(502, "down"));
    const first = await cached("k", 60, load);
    vi.advanceTimersByTime(120_000);
    const second = await cached("k", 60, load);
    expect(second).toMatchObject({ status: "STALE", value: "good", fetchedAt: first.fetchedAt });
  });

  it("stops serving stale data after the stale window", async () => {
    vi.useFakeTimers();
    const load = vi
      .fn()
      .mockResolvedValueOnce("good")
      .mockRejectedValueOnce(new UpstreamError(502, "down"));
    await cached("k", 60, load);
    vi.advanceTimersByTime(11 * 60_000);
    await expect(cached("k", 60, load)).rejects.toMatchObject({ status: 502 });
  });

  it("propagates errors when nothing is cached, and does not cache the failure", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new UpstreamError(504, "slow"))
      .mockResolvedValueOnce("recovered");
    await expect(cached("k", 60, load)).rejects.toMatchObject({ status: 504 });
    await expect(cached("k", 60, load)).resolves.toMatchObject({ value: "recovered" });
  });

  it("keeps separate entries per key", async () => {
    await cached("a", 60, async () => 1);
    const b = await cached("b", 60, async () => 2);
    expect(b.value).toBe(2);
  });
});
