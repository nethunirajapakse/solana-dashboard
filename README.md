# Solana Dashboard

A live Solana analytics dashboard built with **Next.js (App Router) + TypeScript** — trending tokens, candlestick price charts, wallet lookups, and Phantom wallet connection, all backed by the [SolanaTracker Data API](https://docs.solanatracker.io).

The API key stays server-side: the browser only ever talks to internal Next.js API routes, which are the sole place the key is read.

## Features

- **Trending tokens** — the hottest Solana tokens by trading volume over the last hour, with price, 24h change, and market cap (`/`)
- **Token detail pages** — price, 24h change, market cap, and an interactive candlestick chart with switchable intervals (`/token/[mint]`)
- **Wallet explorer** — SOL balance and full SPL token holdings for any address, with base58 validation on both client and server (`/wallet/[address]`)
- **Phantom integration** — extension detection, one-click connect, and public-key display; falls back to a mobile deep link that opens the page inside the Phantom app's browser (`/phantom`)
- **Deliberate UX states** — every data view has explicit loading (skeletons/spinners), error, empty, and invalid-input states

## Tech stack

| Layer   | Choice                                                          |
| ------- | --------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, TypeScript)                           |
| UI      | React 18, custom CSS design tokens (no UI library)              |
| Charts  | [`lightweight-charts`](https://tradingview.github.io/lightweight-charts/) (client-only via dynamic import) |
| Data    | SolanaTracker Data API                                          |
| Wallet  | Phantom provider API (`window.solana` / `window.phantom.solana`) |

## Architecture

The browser never touches SolanaTracker directly. Data pages call internal
API routes, and only those server-side routes read the key and call the
upstream API:

```
Browser → /api/trending           → server reads SOLANA_TRACKER_API_KEY → SolanaTracker
Browser → /api/token/[mint]       → server reads SOLANA_TRACKER_API_KEY → SolanaTracker
Browser → /api/chart/[mint]       → server reads SOLANA_TRACKER_API_KEY → SolanaTracker
Browser → /api/wallet/[address]   → server reads SOLANA_TRACKER_API_KEY → SolanaTracker
```

- `lib/solanaTracker.ts` — fetches from SolanaTracker and normalizes responses into the flat shapes in `types/solana.ts`
- `lib/validate.ts` — base58 address check, run client-side (instant feedback) *and* server-side (since the client check can be bypassed by hitting the route directly)
- `lib/format.ts` — currency / percent / amount formatting helpers

## Getting started

### 1. Get an API key

Sign up at [solanatracker.io](https://www.solanatracker.io/account) (free tier works) and copy your key from the **Data API** tab.

### 2. Run locally

```bash
npm install
cp .env.local.example .env.local
# paste your key into .env.local:
#   SOLANA_TRACKER_API_KEY=your_real_key

npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `.env.local` is gitignored and will never be committed.

### 3. Try it

- `/` — trending tokens load automatically
- `/wallet` — paste any Solana address and hit "Look up"
- `/phantom` — needs the [Phantom extension](https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa); on mobile it offers a deep link into the Phantom app instead

## Deployment (Vercel)

```bash
vercel
```

Or push to GitHub, [import into Vercel](https://vercel.com/new), and add `SOLANA_TRACKER_API_KEY` under **Project Settings → Environment Variables**. The key is read server-side only, so it never needs to be in the repo.

## Project structure

```
app/
  page.tsx                       Trending tokens
  token/[mint]/page.tsx          Token detail + chart
  wallet/page.tsx                Wallet search / redirect
  wallet/[address]/page.tsx      Wallet detail
  phantom/page.tsx               Phantom detection + connect
  api/trending/route.ts          Server route → trending
  api/token/[mint]/route.ts      Server route → token details
  api/chart/[mint]/route.ts      Server route → OHLC candles
  api/wallet/[address]/route.ts  Server route → wallet balances
  layout.tsx, globals.css        Shell + design tokens
components/
  Navbar.tsx, TokenRow.tsx, TokenChart.tsx, CandlestickChart.tsx
lib/
  solanaTracker.ts               Server-side fetch + normalization
  validate.ts                    Address format validation
  format.ts                      Currency / percent / amount formatting
types/
  solana.ts                      Shared TS interfaces
```

## Design decisions

- **Server-side proxy over client-side fetch** — a `NEXT_PUBLIC_` key would ship to every visitor's browser, so all upstream calls go through `/api/*` routes.
- **`lightweight-charts` loaded with `ssr: false`** — the chart library needs the DOM, so it's kept out of the SSR pass entirely via `next/dynamic`.
- **Validation in two places** — checked client-side for UX, re-checked in the API route because the route is directly reachable.
- **No silent failures** — each data page renders distinct loading, error, empty, and invalid states instead of a single catch-all.
