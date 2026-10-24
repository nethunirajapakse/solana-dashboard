// Server-only plumbing for talking to the SolanaTracker Data API:
//   - a request timeout (a hung provider must not hang our routes)
//   - provider failures mapped to honest HTTP statuses with safe messages
//     (we never forward the provider's raw error text to browsers)
//   - a small TTL cache with in-flight de-duplication and stale-if-error.
//
// Why the cache matters: the provider's free plan is 1 request/second and
// 10,000 requests/month. Without caching, a handful of visitors refreshing
// the trending page would burn the monthly quota in days.

const DEFAULT_BASE_URL = "https://data.solanatracker.io";
const REQUEST_TIMEOUT_MS = 8_000;

/** How long an expired cache entry may still be served if the provider is failing. */
const STALE_IF_ERROR_MS = 10 * 60_000;
const MAX_CACHE_ENTRIES = 500;

export class UpstreamError extends Error {
  constructor(
    /** HTTP status WE return to the browser. */
    readonly status: number,
    /** Safe to show to end users. */
    message: string,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

function getApiKey(): string {
  const key = process.env.SOLANA_TRACKER_API_KEY;
  if (!key) {
    // Message is for whoever deployed this; it names no secret.
    throw new UpstreamError(
      503,
      "This deployment has no data API key configured (SOLANA_TRACKER_API_KEY)."
    );
  }
  return key;
}

function baseUrl(): string {
  return process.env.SOLANA_TRACKER_BASE_URL?.replace(/\/+$/, "") || DEFAULT_BASE_URL;
}

export async function trackerFetch(path: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      headers: { "x-api-key": getApiKey() },
      // We cache at the application layer (see cached()) with explicit
      // TTLs and stale-if-error, so opt out of Next's data cache.
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new UpstreamError(504, "The data provider took too long to respond.");
    }
    throw new UpstreamError(502, "Couldn't reach the data provider.");
  }

  if (!res.ok) {
    // Log the real status server-side; show users a stable, safe message.
    console.error(`[upstream] ${res.status} for ${path.split("?")[0]}`);
    if (res.status === 404 || res.status === 400) {
      throw new UpstreamError(404, "The data provider has no data for that address.");
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after"));
      throw new UpstreamError(
        429,
        "Rate limit reached. Please try again in a moment.",
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new UpstreamError(502, "The data provider rejected this server's credentials.");
    }
    throw new UpstreamError(502, "The data provider is having problems.");
  }

  try {
    return await res.json();
  } catch {
    throw new UpstreamError(502, "The data provider returned an unreadable response.");
  }
}

// --- Cache -------------------------------------------------------------

export type CacheStatus = "HIT" | "MISS" | "STALE";

export interface Cached<T> {
  value: T;
  /** Epoch ms when the value was last fetched from the provider. */
  fetchedAt: number;
  status: CacheStatus;
}

interface Entry {
  value: unknown;
  fetchedAt: number;
}

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();

/** Test helper. */
export function resetCache(): void {
  store.clear();
  inflight.clear();
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>
): Promise<Cached<T>> {
  const now = Date.now();
  const hit = store.get(key);

  if (hit && now - hit.fetchedAt < ttlSeconds * 1000) {
    return { value: hit.value as T, fetchedAt: hit.fetchedAt, status: "HIT" };
  }

  // Concurrent requests for the same key share one upstream call.
  let pending = inflight.get(key);
  if (!pending) {
    pending = load()
      .then((value) => {
        const entry: Entry = { value, fetchedAt: Date.now() };
        store.delete(key); // re-insert so Map order == recency
        store.set(key, entry);
        while (store.size > MAX_CACHE_ENTRIES) {
          const oldest = store.keys().next().value;
          if (oldest === undefined) break;
          store.delete(oldest);
        }
        return entry;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }

  try {
    const entry = await pending;
    return { value: entry.value as T, fetchedAt: entry.fetchedAt, status: "MISS" };
  } catch (err) {
    // Provider is failing but we have an older answer: better stale than blank.
    if (hit && now - hit.fetchedAt < STALE_IF_ERROR_MS) {
      return { value: hit.value as T, fetchedAt: hit.fetchedAt, status: "STALE" };
    }
    throw err;
  }
}
