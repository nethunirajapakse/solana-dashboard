# Solana Dashboard

Track trending Solana tokens, keep a watchlist, and inspect any wallet's
holdings. Free to use, no account needed. Built with Next.js (App Router),
React 19 and TypeScript; market data comes from the
[SolanaTracker Data API](https://docs.solanatracker.io).

## Features

| Route               | What it does                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`                 | Trending tokens by window (5m / 1h / 6h / 24h): filter, sort any column, auto-refresh, star to watch      |
| `/watchlist`        | Your starred tokens with live prices (one batched request for the whole list)                             |
| `/token/[mint]`     | Price, 24h change, market cap, liquidity, candlestick + volume chart (1m–1d, auto log scale for 50x+ movers) with OHLC readout and local-time axis, copy mint, Solscan link              |
| `/wallet`           | Look up any address; saved wallets with autosaving names; recent lookups                                  |
| `/wallet/[address]` | SOL + token holdings, sorted by value, share of portfolio, hide unpriced/under-$1 "dust", save, copy      |
| `/phantom`          | Connect Phantom (read-only) and open your own portfolio; restores a prior connection without a popup      |
| `/api/health`       | Liveness probe for uptime monitors / containers                                                           |

Watchlist, saved wallets and recents live in the browser (`localStorage`):
no sign-up, nothing sent to a server.

## How it works

```
Browser ──▶ /api/*  (Next route handlers, server-side)
              │  1. validate input (allowlists + real base58 check)
              │  2. TTL cache · in-flight de-duplication · stale-if-error
              │  3. call SolanaTracker with the API key (8s timeout)
              ▼
          SolanaTracker Data API
```

- **The API key never reaches the browser.** Only the route handlers read
  `SOLANA_TRACKER_API_KEY`.
- **Caching is load-bearing, not an optimisation.** SolanaTracker's free plan
  is documented as 1 request/second and 10,000 requests/month. Without a
  cache, a handful of visitors would exhaust that in days. Each route caches
  in memory (30s–15min depending on how fast the data moves), shares one
  upstream call between concurrent requests, serves **stale data if the
  provider is failing**, and sends `Cache-Control: s-maxage` so a CDN (e.g.
  Vercel's) absorbs repeat traffic too. Responses carry `X-Cache: HIT|MISS|STALE`.
- **Typed contract.** Every response is a versioned-by-convention JSON
  envelope validated with [zod](https://zod.dev) in `lib/contracts.ts`; the
  browser parses each response with the same schema, so drift fails loudly in
  one place. Schemas are type-checked against `types/solana.ts`.
- **Honest failure modes.** Provider failures map to meaningful statuses and
  safe messages (never the provider's raw error text):

  | Status | Meaning                                                  |
  | ------ | -------------------------------------------------------- |
  | 400    | Invalid input (bad address, timeframe, interval, mints)  |
  | 404    | The provider has no data for that address                |
  | 429    | Provider rate limit hit (`Retry-After` is passed through) |
  | 502    | Provider down, or rejected this server's credentials     |
  | 503    | This deployment has no API key configured                |
  | 504    | Provider timed out                                       |

### API

All `GET`. The data routes return `{ ...data, fetchedAt }` (epoch ms the
*server* last got the data from the provider) or `{ error }`.

| Route                                 | Notes                                                        | Cache  |
| ------------------------------------- | ------------------------------------------------------------ | ------ |
| `/api/trending?timeframe=1h`          | `5m 15m 30m 1h 2h 3h 4h 5h 6h 12h 24h`                       | 120s   |
| `/api/token/:mint`                    | name, price, 24h change, market cap, liquidity               | 60s    |
| `/api/wallet/:address`                | SOL + SPL holdings                                           | 60s    |
| `/api/chart/:mint?interval=1h`        | `1m 5m 15m 1h 4h 1d`; explicit lookback window, malformed/duplicate candles cleaned, empty intervals filled with flat candles | 60–900s |
| `/api/prices?mints=a,b,c`             | 1–50 mints, **one** upstream call (powers the watchlist)     | 30s    |
| `/api/health`                         | `200 ok` / `503 degraded` (no key); never calls the provider | none   |

## Run it

```bash
npm install
cp .env.local.example .env.local   # then paste your SolanaTracker key
npm run dev                         # http://localhost:3000
```

Get a free key at [solanatracker.io](https://www.solanatracker.io/account)
(Data API tab).

### Quality checks

```bash
npm run lint        # ESLint (Next + React 19 hooks rules)
npm run typecheck   # tsc --noEmit
npm test            # Vitest + React Testing Library
npm run check       # all three
```

Tests cover the validators, formatters, cache and upstream error mapping, every
API route (including regression tests for rejecting malformed timeframes),
the fetch hook, the persisted-list store, and each page's loading / error /
empty / success states. CI (`.github/workflows/ci.yml`) runs lint, typecheck,
tests and a production build on every push and pull request, then builds and
smoke-tests the Docker image.

### Docker

```bash
docker build -t solana-dashboard .
docker run --rm -p 3000:3000 -e SOLANA_TRACKER_API_KEY=your_key solana-dashboard
```

Multi-stage build, non-root user, and a healthcheck against `/api/health`
(a container with no API key reports unhealthy on purpose).

### Deploy to Vercel

1. Push to GitHub and [import the repo](https://vercel.com/new).
2. Add `SOLANA_TRACKER_API_KEY` under **Project Settings → Environment Variables**.
3. Deploy. Cookieless page-view analytics (`@vercel/analytics`) switch on
   automatically on Vercel; enable **Analytics** in the project dashboard to see them.

## Project structure

```
app/
  page.tsx                      Trending
  watchlist/ wallet/ token/ phantom/   Pages (+ per-section metadata)
  api/{trending,token,wallet,chart,prices,health}/route.ts
  error.tsx  not-found.tsx  robots.ts  icon.svg  layout.tsx  globals.css
components/                     TokenRow, WatchButton, SavedWalletRow, Freshness, charts, state views
hooks/
  useApi.ts                     typed fetch: abort, retry, auto-refresh, stale-on-failed-refresh
  usePersistedList.ts           useSyncExternalStore binding
lib/
  upstream.ts                   timeout, error mapping, TTL cache + dedupe + stale-if-error
  solanaTracker.ts              provider calls + normalisation
  contracts.ts                  zod schemas (the JSON contract)
  persistedList.ts / stores.ts  localStorage-backed lists (validated, cross-tab, fail-safe)
  validate.ts                   real base58 / 32-byte address check
  tokenList.ts portfolio.ts format.ts
types/solana.ts
```

## Design decisions and known limitations

- **In-memory cache is per server instance.** On serverless platforms each
  instance has its own cache; the `s-maxage` headers (CDN) are what provide
  shared caching there. For heavy traffic, put Redis/Upstash behind `cached()`.
- **No per-IP rate limiting.** Caching protects the provider quota, but an
  abusive client can still hit uncached combinations (e.g. many different
  wallet addresses). Add edge rate limiting before promoting this widely.
- **Watchlist and saved wallets are per-browser.** Clearing site data or
  switching devices loses them. Cross-device sync and price alerts would need
  accounts and a database.
- **Phantom is read-only.** The app only reads your public address; it never
  requests signatures or transactions.
- **Data accuracy is the provider's.** Prices can lag by minutes and the
  footer says so. This is not financial advice.
- **Security headers are set** (`nosniff`, frame deny, referrer, permissions
  policy). A Content-Security-Policy is not: token images come from arbitrary
  third-party hosts and Next needs inline scripts, so a useful CSP requires
  nonce setup that is left for later.
- **Stack choices:** `lightweight-charts` (TradingView, Apache-2.0, keeps its
  attribution logo) for candles; zod for the contract; no UI framework: plain CSS
  with design tokens in `globals.css`.

## Roadmap ideas

- Price alerts (needs auth + a store + a scheduled job)
- Shareable trending filters via URL params
- Redis-backed cache and edge rate limiting
- Per-token holder / transaction views
