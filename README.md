# Solana Dashboard

A small web app for keeping an eye on Solana tokens: see what's trending, star
the ones you care about, open a candlestick chart, and look up what any wallet
is holding. No account, no sign-up. Built with Next.js, React 19 and
TypeScript, using the [SolanaTracker Data API](https://docs.solanatracker.io).

## What you can do

- **Trending** (`/`): tokens ranked over 5m, 1h, 6h or 24h. Filter by name or
  mint, sort any column, star a token to watch it. Refreshes itself.
- **Watchlist** (`/watchlist`): your starred tokens with live prices.
- **Token page** (`/token/[mint]`): price, 24h change, market cap, liquidity,
  and a candlestick chart with volume. Intervals from 1m to 1d, a log scale
  (turned on automatically for tokens that moved 50x or more), an OHLC readout
  on hover, and times in your own timezone.
- **Wallets** (`/wallet`): look up any address and see SOL and token holdings
  by value. Save wallets with a name, and hide worthless "dust" tokens.
- **Phantom** (`/phantom`): connect Phantom to open your own portfolio. It only
  reads your public address and never asks for a signature.
- **Light and dark**: follows your system setting; the button in the navbar
  switches between Auto, Light and Dark.

Your watchlist, saved wallets and recent lookups are stored in your browser
only. Nothing about them reaches a server.

## Why the server is in the middle

The browser never talks to SolanaTracker directly. It calls this app's own
`/api/*` routes, and those call the provider.

```
Browser  →  /api/*  (Next route handlers)  →  SolanaTracker
              validate input · cache · timeout · safe errors
```

The reasons are practical:

- **The API key stays on the server.** Only the route handlers read
  `SOLANA_TRACKER_API_KEY`.
- **The free plan is small** (1 request/second, 10,000 requests/month), so
  caching is what keeps the app usable. Each route keeps results in memory for
  30 seconds to 15 minutes depending on how fast the data changes, shares one
  upstream call between simultaneous requests, and falls back to the last good
  data if the provider is down. Responses also send `Cache-Control: s-maxage`
  so a CDN can absorb repeat traffic, and an `X-Cache: HIT | MISS | STALE`
  header shows what happened.
- **Inputs are checked before anything is forwarded.** Timeframes and intervals
  come from allowlists, and addresses must be real base58 that decode to 32
  bytes.
- **Responses are validated** with [zod](https://zod.dev) on the way out and
  again in the browser, so a change in the data shape fails in one obvious
  place instead of rendering `undefined`.
- **Errors say something useful** without leaking the provider's raw message:

  | Status | Meaning                                              |
  | ------ | ---------------------------------------------------- |
  | 400    | Bad input (address, timeframe, interval, mints)      |
  | 404    | The provider has nothing for that address            |
  | 429    | Rate limited by the provider (`Retry-After` passed on) |
  | 502    | Provider is down or rejected this server's key       |
  | 503    | No API key configured on this deployment             |
  | 504    | Provider timed out                                   |

### API routes

All are `GET` and return `{ ...data, fetchedAt }` or `{ error }`.

| Route                          | Returns                                              | Cache    |
| ------------------------------ | ---------------------------------------------------- | -------- |
| `/api/trending?timeframe=1h`   | trending tokens (`5m` … `24h`)                       | 120s     |
| `/api/token/:mint`             | name, price, 24h change, market cap, liquidity       | 60s      |
| `/api/wallet/:address`         | SOL and token holdings                               | 60s      |
| `/api/chart/:mint?interval=1h` | candles with volume (`1m 5m 15m 1h 4h 1d`)           | 30–900s  |
| `/api/prices?mints=a,b,c`      | prices for up to 50 mints in one upstream call       | 30s      |
| `/api/health`                  | `200 ok`, or `503` if no key is set                  | none     |

The chart route asks for an explicit time window, drops malformed or duplicate
candles, and fills intervals with no trades using flat candles, so the time
axis isn't squashed.

## Run it locally

```bash
npm install
cp .env.local.example .env.local   # add your SolanaTracker key
npm run dev                         # http://localhost:3000
```

A free key is available at [solanatracker.io](https://www.solanatracker.io/account)
(Data API tab).

### Checks

```bash
npm run lint        # ESLint
npm run typecheck   # tsc
npm test            # Vitest + React Testing Library
npm run check       # all three
```

The tests cover the validators and formatters, the cache and error mapping,
every API route, the fetch hook, the saved-list store, the theme switch, and
the loading / error / empty / success states of each page. GitHub Actions runs
lint, typecheck, tests and a production build on every push and pull request,
then builds and smoke-tests the Docker image.

### Docker

```bash
docker build -t solana-dashboard .
docker run --rm -p 3000:3000 -e SOLANA_TRACKER_API_KEY=your_key solana-dashboard
```

The image is multi-stage and runs as a non-root user. Its healthcheck calls
`/api/health`, so a container without a key reports unhealthy on purpose.

### Deploy to Vercel

1. Push to GitHub and [import the repo](https://vercel.com/new).
2. Add `SOLANA_TRACKER_API_KEY` under Project Settings → Environment Variables.
3. Deploy. Cookieless page-view analytics turn on by themselves on Vercel;
   enable Analytics in the project dashboard to see them.

## Project layout

```
app/          pages, API route handlers, layout, global CSS
components/   token rows, charts, buttons, theme switch, loading/error views
hooks/        useApi (fetch with abort, retry, auto-refresh), usePersistedList
lib/          upstream (timeout, cache, errors), solanaTracker (provider calls),
              contracts (zod schemas), validate, format, stores
types/        shared types
```

## Limits and trade-offs

- **The cache lives in each server instance's memory.** On serverless hosting
  every instance has its own, so the CDN headers do the shared caching. With
  real traffic, put Redis behind `cached()`.
- **No per-IP rate limiting.** Caching protects the quota, but someone could
  still request many different uncached wallet addresses. Add edge rate
  limiting before sharing this widely.
- **Watchlist and saved wallets are per browser.** Clearing site data or
  switching devices loses them. Syncing them, or adding price alerts, would
  need accounts and a database.
- **Prices come from the provider** and can lag by a few minutes. This isn't
  financial advice.
- **No Content-Security-Policy yet.** Token images come from many third-party
  hosts and Next needs inline scripts, so a useful policy needs a nonce setup.
  Other security headers (`nosniff`, frame deny, referrer, permissions) are on.
- **Chart library:** `lightweight-charts` by TradingView (Apache-2.0), which
  requires keeping its logo. There's no UI framework; the styling is plain CSS
  with design tokens in `globals.css`.

## Ideas for later

- Price alerts (needs auth, a store and a scheduled job)
- Shareable trending filters in the URL
- Redis cache and edge rate limiting
- Holder and transaction views per token
