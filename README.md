# Solana Dashboard

A small Next.js (App Router + TypeScript) app with three pages:

| Route              | What it does                                              |
| ------------------ | ---------------------------------------------------------- |
| `/`                 | Trending Solana tokens (name, symbol, price, 24h change)  |
| `/wallet/[address]` | SOL balance + SPL token balances for a wallet address     |
| `/phantom`          | Detects Phantom, connects, and shows the public key        |

Data comes from the [SolanaTracker Data API](https://docs.solanatracker.io).

## How it's wired together

The API key is **never sent to the browser**. Both data pages call an
internal Next.js API route (`/api/trending`, `/api/wallet/[address]`),
and those routes — which run server-side — are the only place that reads
`process.env.SOLANA_TRACKER_API_KEY` and calls `data.solanatracker.io`.

```
Browser  →  /api/trending          →  server reads API key  →  SolanaTracker
Browser  →  /api/wallet/[address]  →  server reads API key  →  SolanaTracker
```

- `lib/solanaTracker.ts` — fetches from SolanaTracker and normalizes the
  response into the flatter shapes in `types/solana.ts`.
- `lib/validate.ts` — base58 address format check, used both client-side
  (instant feedback) and server-side (reject bad input before calling the
  API).
- `lib/format.ts` — currency/percentage/amount formatting helpers.

## 1. Get an API key

1. Sign up at [solanatracker.io](https://www.solanatracker.io/account) (free tier is fine).
2. Copy your key from the **Data API** tab of your dashboard.

## 2. Run locally

```bash
npm install
cp .env.local.example .env.local
# then paste your key into .env.local:
#   SOLANA_TRACKER_API_KEY=your_real_key

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`.env.local` is in `.gitignore` — it will never be committed.

## 3. Try it

- `/` — trending tokens load automatically.
- `/wallet` — paste any Solana address and hit "Look up" (or go straight to
  `/wallet/<address>`). Try a well-known one to sanity check, e.g. the
  Solana Foundation's address, or your own if you have Phantom installed.
- `/phantom` — needs the [Phantom extension](https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa)
  installed in Chrome. Without it, you'll see the install prompt instead.

## 4. Deploy to Vercel

```bash
npm i -g vercel   # if you don't have it
vercel
```

Or via the dashboard:

1. Push this repo to GitHub.
2. [Import it into Vercel](https://vercel.com/new).
3. In **Project Settings → Environment Variables**, add:
   - `SOLANA_TRACKER_API_KEY` = your key
4. Deploy.

The env var only needs to exist in Vercel's project settings — it's read
server-side by the API routes, so it's fine that it's not in the repo.

## Project structure

```
app/
  page.tsx                     Trending tokens (client component)
  wallet/page.tsx               Wallet search / redirect form
  wallet/[address]/page.tsx     Wallet detail (client component)
  phantom/page.tsx              Phantom detection + connect
  api/trending/route.ts         Server route → SolanaTracker trending
  api/wallet/[address]/route.ts Server route → SolanaTracker wallet
  layout.tsx, globals.css       Shell + design tokens
components/
  Navbar.tsx, TokenRow.tsx
lib/
  solanaTracker.ts   Server-side fetch + normalization
  validate.ts         Address format validation
  format.ts           Currency / percent / amount formatting
types/
  solana.ts           Shared TS interfaces
```

## Notes on design choices

- **Server-side proxy over client-side fetch**: the API key requirement
  said `.env.local`, and a `NEXT_PUBLIC_` var would ship the key to every
  visitor's browser. Routing through `/api/*` keeps it server-only.
- **Loading/error states**: each data page has an explicit loading
  (skeleton/spinner), error, and empty state rather than a single
  try/catch that silently fails.
- **Address validation**: checked client-side for instant feedback, and
  again server-side in the API route, since the client check can be
  bypassed by hitting the route directly.
