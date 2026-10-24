import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { useApi } from "@/hooks/useApi";

const Schema = z.object({ value: z.number() });

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

describe("useApi", () => {
  it("goes loading -> ready with parsed data", async () => {
    fetchMock.mockResolvedValue(ok({ value: 1 }));
    const { result } = renderHook(() => useApi("/a", Schema));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.data).toEqual({ value: 1 });
    expect(result.current.error).toBeNull();
    expect(result.current.receivedAt).not.toBeNull();
  });

  it("stays idle and never fetches without a URL", () => {
    const { result } = renderHook(() => useApi(null, Schema));
    expect(result.current.status).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces the API's error message, and recovers on retry", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Rate limit reached." }), { status: 429 }))
      .mockResolvedValueOnce(ok({ value: 2 }));
    const { result } = renderHook(() => useApi("/a", Schema));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Rate limit reached.");

    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.data).toEqual({ value: 2 });
    expect(result.current.error).toBeNull();
  });

  it("falls back to the HTTP status when the error body isn't JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>boom</html>", { status: 500 }));
    const { result } = renderHook(() => useApi("/a", Schema));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Request failed (500).");
  });

  it("gives a friendly message for network failures", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useApi("/a", Schema));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/Network error/);
  });

  it("rejects a response that breaks the contract instead of rendering garbage", async () => {
    fetchMock.mockResolvedValue(ok({ value: "not a number" }));
    const { result } = renderHook(() => useApi("/a", Schema));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/couldn't understand/);
    expect(result.current.data).toBeUndefined();
  });

  it("keeps the last good data when a background refresh fails", async () => {
    fetchMock.mockResolvedValueOnce(ok({ value: 1 })).mockRejectedValueOnce(new TypeError("offline"));
    const { result } = renderHook(() => useApi("/a", Schema));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.status).toBe("ready"); // still showing data, not an error screen
    expect(result.current.data).toEqual({ value: 1 });
  });

  it("flags refreshes in flight without dropping data", async () => {
    let release!: (r: Response) => void;
    fetchMock
      .mockResolvedValueOnce(ok({ value: 1 }))
      .mockImplementationOnce(() => new Promise<Response>((r) => (release = r)));
    const { result } = renderHook(() => useApi("/a", Schema));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isRefreshing).toBe(true));
    expect(result.current.data).toEqual({ value: 1 });

    await act(async () => release(ok({ value: 2 })));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.data).toEqual({ value: 2 });
  });

  it("aborts the old request and shows loading (not stale data) when the URL changes", async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      signals.push(init.signal as AbortSignal);
      return ok({ value: url === "/a" ? 1 : 2 });
    });
    const { result, rerender } = renderHook(({ url }) => useApi(url, Schema), {
      initialProps: { url: "/a" },
    });
    await waitFor(() => expect(result.current.data).toEqual({ value: 1 }));

    rerender({ url: "/b" });
    expect(signals[0].aborted).toBe(true);
    expect(result.current.status).toBe("loading");
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data).toEqual({ value: 2 }));
  });

  it("auto-refreshes on an interval while the tab is visible", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockImplementation(async () => ok({ value: 1 }));
    renderHook(() => useApi("/a", Schema, { refreshMs: 10_000 }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("does not refresh in the background while the tab is hidden", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockImplementation(async () => ok({ value: 1 }));
    renderHook(() => useApi("/a", Schema, { refreshMs: 10_000 }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await act(async () => {
      vi.advanceTimersByTime(35_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
