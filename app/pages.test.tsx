import { Suspense } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/",
}));

vi.mock("@/components/TokenChart", () => ({
  default: ({ mint }: { mint: string }) => <div data-testid="chart">chart for {mint}</div>,
}));

import TrendingPage from "@/app/page";
import WatchlistPage from "@/app/watchlist/page";
import WalletDetailPage from "@/app/wallet/[address]/page";
import WalletSearchPage from "@/app/wallet/page";
import PhantomPage from "@/app/phantom/page";
import TokenDetailPage from "@/app/token/[mint]/page";
import { recentWallets, savedWallets, watchlist } from "@/lib/stores";

const MINT_A = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const MINT_B = "So11111111111111111111111111111111111111112";
const MINT_C = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";
const WALLET = "11111111111111111111111111111111";

const tok = (mint: string, name: string, symbol: string, over = {}) => ({
  mint,
  name,
  symbol,
  image: null,
  priceUsd: 1,
  change1h: 0,
  change24h: 0,
  marketCapUsd: 1000,
  liquidityUsd: 100,
  ...over,
});

type Routes = Record<string, () => Response | Promise<Response>>;
function mockFetch(routes: Routes) {
  const fn = vi.fn(async (url: string) => {
    const handler = routes[url];
    if (!handler) return new Response(JSON.stringify({ error: `unmocked ${url}` }), { status: 500 });
    return handler();
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  localStorage.clear();
  watchlist.clear();
  savedWallets.clear();
  recentWallets.clear();
  push.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (window as { phantom?: unknown }).phantom;
});

const rowNames = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1) // header
    .map((r) => r.querySelector(".token-name")?.textContent ?? "");

describe("Trending page", () => {
  const trending = (tokens: unknown[]) => json({ timeframe: "1h", tokens, fetchedAt: Date.now() });

  it("renders the ranked list, then filters and sorts it", async () => {
    const user = userEvent.setup();
    mockFetch({
      "/api/trending?timeframe=1h": trending([
        tok(MINT_A, "Alpha", "ALP", { priceUsd: 5, change24h: 10 }),
        tok(MINT_B, "Beta", "BTA", { priceUsd: 50, change24h: -3 }),
        tok(MINT_C, "Gamma", "GMA", { priceUsd: null, change24h: null }),
      ]),
    });
    render(<TrendingPage />);

    await screen.findByRole("table", { name: "Trending tokens" });
    expect(rowNames()).toEqual(["Alpha", "Beta", "Gamma"]);

    // sort by price: desc, then asc; unpriced always last
    await user.click(screen.getByRole("button", { name: /^Price/ }));
    expect(rowNames()).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(screen.getByRole("columnheader", { name: /Price/ })).toHaveAttribute("aria-sort", "descending");
    await user.click(screen.getByRole("button", { name: /^Price/ }));
    expect(rowNames()).toEqual(["Alpha", "Beta", "Gamma"]);

    // filter
    await user.type(screen.getByLabelText("Filter tokens"), "bta");
    expect(rowNames()).toEqual(["Beta"]);
    await user.clear(screen.getByLabelText("Filter tokens"));
    await user.type(screen.getByLabelText("Filter tokens"), "zzz");
    expect(screen.getByText(/No tokens match "zzz"/)).toBeInTheDocument();
  });

  it("fetches the selected timeframe when a tab is clicked", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      "/api/trending?timeframe=1h": trending([tok(MINT_A, "Alpha", "ALP")]),
      "/api/trending?timeframe=24h": trending([tok(MINT_B, "Beta", "BTA")]),
    });
    render(<TrendingPage />);
    await screen.findByText("Alpha");

    await user.click(screen.getByRole("tab", { name: "24h" }));
    expect(await screen.findByText("Beta")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/trending?timeframe=24h", expect.anything());
    expect(screen.getByRole("tab", { name: "24h" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the server's error with a working retry", async () => {
    const user = userEvent.setup();
    let calls = 0;
    mockFetch({
      "/api/trending?timeframe=1h": () =>
        ++calls === 1
          ? new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }), { status: 429 })
          : new Response(JSON.stringify({ timeframe: "1h", tokens: [tok(MINT_A, "Alpha", "ALP")], fetchedAt: Date.now() })),
    });
    render(<TrendingPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Rate limit reached");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing is trending", async () => {
    mockFetch({ "/api/trending?timeframe=1h": trending([]) });
    render(<TrendingPage />);
    expect(await screen.findByText("No trending tokens right now.")).toBeInTheDocument();
  });

  it("stars a token into the watchlist from the table", async () => {
    const user = userEvent.setup();
    mockFetch({ "/api/trending?timeframe=1h": trending([tok(MINT_A, "Alpha", "ALP")]) });
    render(<TrendingPage />);
    await user.click(await screen.findByRole("button", { name: /Add Alpha to watchlist/ }));
    expect(watchlist.getSnapshot().map((t) => t.mint)).toEqual([MINT_A]);
  });
});

describe("Watchlist page", () => {
  const add = (mint: string, name: string, symbol: string, addedAt: number) =>
    watchlist.add({ mint, name, symbol, image: null, addedAt });

  it("explains how to get started when empty, and never calls the API", () => {
    const fetchMock = mockFetch({});
    render(<WatchlistPage />);
    expect(screen.getByText("Your watchlist is empty.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse trending tokens/ })).toHaveAttribute("href", "/");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows saved tokens immediately and fills in prices from ONE batched request", async () => {
    add(MINT_A, "Alpha", "ALP", 1);
    add(MINT_B, "Beta", "BTA", 2); // newest first -> Beta, Alpha
    const fetchMock = mockFetch({
      [`/api/prices?mints=${MINT_B},${MINT_A}`]: json({
        prices: {
          [MINT_A]: { mint: MINT_A, priceUsd: 2, change24h: 5, marketCapUsd: 2_000_000, liquidityUsd: 1 },
          [MINT_B]: { mint: MINT_B, priceUsd: 10, change24h: -1, marketCapUsd: null, liquidityUsd: null },
        },
        fetchedAt: Date.now(),
      }),
    });
    render(<WatchlistPage />);

    // rows exist before prices arrive
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();

    expect(await screen.findByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("$2.00")).toBeInTheDocument();
    expect(screen.getByText("+5.00%")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps rows visible and offers retry if prices fail", async () => {
    add(MINT_A, "Alpha", "ALP", 1);
    mockFetch({ [`/api/prices?mints=${MINT_A}`]: json({ error: "The data provider is having problems." }, 502) });
    render(<WatchlistPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("having problems");
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("removes a token and returns to the empty state", async () => {
    const user = userEvent.setup();
    add(MINT_A, "Alpha", "ALP", 1);
    mockFetch({
      [`/api/prices?mints=${MINT_A}`]: json({ prices: {}, fetchedAt: Date.now() }),
    });
    render(<WatchlistPage />);
    await user.click(await screen.findByRole("button", { name: /Remove Alpha from watchlist/ }));
    expect(screen.getByText("Your watchlist is empty.")).toBeInTheDocument();
  });
});

describe("Wallet detail page", () => {
  const wallet = {
    address: WALLET,
    solBalance: 2,
    solValueUsd: 300,
    totalValueUsd: 1000,
    tokens: [
      { mint: MINT_A, name: "Small", symbol: "SML", amount: 5, valueUsd: 0.5 },
      { mint: MINT_B, name: "Big", symbol: "BIG", amount: 1, valueUsd: 600 },
      { mint: MINT_C, name: "Spam", symbol: "SPM", amount: 9_999_999, valueUsd: null },
      { mint: "Mid1111111111111111111111111111111", name: "Mid", symbol: "MID", amount: 100, valueUsd: 100 },
    ],
  };

  // `use(params)` suspends until the promise settles; an async act flushes that retry.
  async function renderPage(address: string) {
    const params = Promise.resolve({ address });
    await act(async () => {
      render(
        <Suspense fallback={<div>suspended</div>}>
          <WalletDetailPage params={params} />
        </Suspense>
      );
    });
  }

  const holdings = () =>
    within(screen.getByRole("table", { name: "Token holdings" }))
      .getAllByRole("row")
      .slice(1)
      .map((r) => r.querySelector(".token-name")?.textContent ?? "");

  it("rejects an invalid address without calling the API", async () => {
    const fetchMock = mockFetch({});
    await renderPage("not-a-wallet");
    expect(await screen.findByRole("alert")).toHaveTextContent("isn't a valid Solana wallet address");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists holdings by value, with share of portfolio, and a dust filter", async () => {
    const user = userEvent.setup();
    mockFetch({ [`/api/wallet/${WALLET}`]: json({ wallet, fetchedAt: Date.now() }) });
    await renderPage(WALLET);

    await screen.findByRole("table", { name: "Token holdings" });
    expect(screen.getByText("2 SOL")).toBeInTheDocument();
    expect(holdings()).toEqual(["Big", "Mid", "Small", "Spam"]); // priced desc, unpriced last
    expect(screen.getByText("60.0%")).toBeInTheDocument(); // 600 / 1000

    await user.click(screen.getByLabelText(/Hide unpriced \/ under \$1 \(2\)/));
    expect(holdings()).toEqual(["Big", "Mid"]);
    expect(screen.getByText(/Token holdings \(2 of 4\)/)).toBeInTheDocument();
  });

  it("re-sorts by balance when the header is clicked", async () => {
    const user = userEvent.setup();
    mockFetch({ [`/api/wallet/${WALLET}`]: json({ wallet, fetchedAt: Date.now() }) });
    await renderPage(WALLET);
    await screen.findByRole("table", { name: "Token holdings" });

    await user.click(screen.getByRole("button", { name: /^Balance/ }));
    expect(holdings()[0]).toBe("Spam");
  });

  it("saves the wallet and records the lookup under recents", async () => {
    const user = userEvent.setup();
    mockFetch({ [`/api/wallet/${WALLET}`]: json({ wallet, fetchedAt: Date.now() }) });
    await renderPage(WALLET);
    await screen.findByRole("table", { name: "Token holdings" });

    await waitFor(() => expect(recentWallets.getSnapshot().map((r) => r.address)).toEqual([WALLET]));
    await user.click(screen.getByRole("button", { name: "Save wallet" }));
    expect(savedWallets.getSnapshot().map((w) => w.address)).toEqual([WALLET]);
    expect(screen.getByRole("button", { name: "Saved ✓" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows an error with retry when the wallet can't be loaded", async () => {
    mockFetch({ [`/api/wallet/${WALLET}`]: json({ error: "The data provider has no data for that address." }, 404) });
    await renderPage(WALLET);
    expect(await screen.findByRole("alert")).toHaveTextContent("no data for that address");
  });
});

describe("Wallet search page", () => {
  it("validates before navigating, then navigates for a valid address", async () => {
    const user = userEvent.setup();
    render(<WalletSearchPage />);
    const input = screen.getByLabelText("Solana wallet address");

    await user.type(input, "nonsense");
    await user.click(screen.getByRole("button", { name: "Look up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("valid Solana address");
    expect(push).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, `  ${WALLET}  `);
    await user.click(screen.getByRole("button", { name: "Look up" }));
    expect(push).toHaveBeenCalledWith(`/wallet/${WALLET}`);
  });

  it("lists saved wallets and recents (without duplicating saved ones)", () => {
    savedWallets.add({ address: WALLET, label: "Main", savedAt: 1 });
    recentWallets.add({ address: WALLET, visitedAt: 1 });
    recentWallets.add({ address: MINT_C, visitedAt: 2 });
    render(<WalletSearchPage />);

    expect(screen.getByDisplayValue("Main")).toBeInTheDocument();
    expect(screen.getByText("Recent lookups")).toBeInTheDocument();
    expect(screen.getAllByRole("link").filter((l) => l.getAttribute("href") === `/wallet/${WALLET}`)).toHaveLength(1);
  });
});

describe("Phantom page", () => {
  type Provider = {
    isPhantom: boolean;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };
  const install = (trusted: boolean): Provider => {
    const provider: Provider = {
      isPhantom: true,
      connect: vi.fn(async (opts?: { onlyIfTrusted?: boolean }) => {
        if (opts?.onlyIfTrusted && !trusted) throw new Error("User has not approved");
        return { publicKey: { toString: () => WALLET } };
      }),
      disconnect: vi.fn(async () => {}),
      on: vi.fn(),
      off: vi.fn(),
    };
    (window as { phantom?: unknown }).phantom = { solana: provider };
    return provider;
  };

  it("points people without the extension to install it, or to use address lookup", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<PhantomPage />);
    expect(screen.getByText("Checking for Phantom…")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("link", { name: /Get Phantom/ })).toHaveAttribute(
      "href",
      expect.stringContaining("chromewebstore.google.com")
    );
    expect(screen.getByRole("link", { name: /look up any wallet by address/ })).toHaveAttribute("href", "/wallet");
  });

  it("connects, links to the user's own portfolio, and disconnects", async () => {
    const user = userEvent.setup();
    const provider = install(false);
    render(<PhantomPage />);

    await user.click(await screen.findByRole("button", { name: "Connect Phantom" }));
    expect(await screen.findByText(WALLET)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View my portfolio/ })).toHaveAttribute("href", `/wallet/${WALLET}`);

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(provider.disconnect).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Connect Phantom" })).toBeInTheDocument();
  });

  it("silently restores a previously approved connection (no popup)", async () => {
    const provider = install(true);
    render(<PhantomPage />);
    expect(await screen.findByText(WALLET)).toBeInTheDocument();
    expect(provider.connect).toHaveBeenCalledWith({ onlyIfTrusted: true });
  });

  it("shows the rejection message if the user declines", async () => {
    const user = userEvent.setup();
    const provider = install(false);
    provider.connect.mockImplementation(async (opts?: { onlyIfTrusted?: boolean }) => {
      throw new Error(opts?.onlyIfTrusted ? "not trusted" : "User rejected the request.");
    });
    render(<PhantomPage />);
    await user.click(await screen.findByRole("button", { name: "Connect Phantom" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("User rejected the request.");
  });

  it("stops listening to the extension when the page unmounts", async () => {
    const provider = install(true);
    const { unmount } = render(<PhantomPage />);
    await screen.findByText(WALLET);
    unmount();
    expect(provider.off).toHaveBeenCalledWith("accountChanged", expect.any(Function));
    expect(provider.off).toHaveBeenCalledWith("disconnect", expect.any(Function));
  });
});

describe("Token detail page", () => {
  const detail = {
    mint: MINT_A,
    name: "Alpha Coin",
    symbol: "ALP",
    image: null,
    priceUsd: 0.00002193,
    change24h: 12.5,
    marketCapUsd: 3_400_000,
    liquidityUsd: 85_000,
  };

  async function renderToken(mint: string) {
    const params = Promise.resolve({ mint });
    await act(async () => {
      render(
        <Suspense fallback={<div>suspended</div>}>
          <TokenDetailPage params={params} />
        </Suspense>
      );
    });
  }

  it("shows the token's stats, links out, and mounts the chart", async () => {
    mockFetch({ [`/api/token/${MINT_A}`]: json({ token: detail, fetchedAt: Date.now() }) });
    await renderToken(MINT_A);

    expect(await screen.findByRole("heading", { name: "Alpha Coin" })).toBeInTheDocument();
    expect(screen.getByText("$0.00002193")).toBeInTheDocument();
    expect(screen.getByText("+12.50%")).toHaveClass("change-up");
    expect(screen.getByText("$3.40M")).toBeInTheDocument();
    expect(screen.getByText("$85.00K")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Solscan/ })).toHaveAttribute("href", `https://solscan.io/token/${MINT_A}`);
    expect(screen.getByTestId("chart")).toHaveTextContent(MINT_A);
  });

  it("can be added to the watchlist from the header", async () => {
    const user = userEvent.setup();
    mockFetch({ [`/api/token/${MINT_A}`]: json({ token: detail, fetchedAt: Date.now() }) });
    await renderToken(MINT_A);

    await user.click(await screen.findByRole("button", { name: /Add Alpha Coin to watchlist/ }));
    expect(watchlist.getSnapshot()[0]).toMatchObject({ mint: MINT_A, name: "Alpha Coin", symbol: "ALP" });
    expect(screen.getByText("Watching")).toBeInTheDocument();
  });

  it("rejects an invalid mint without calling the API", async () => {
    const fetchMock = mockFetch({});
    await renderToken("nope");
    expect(await screen.findByRole("alert")).toHaveTextContent("isn't a valid Solana token mint");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains an unknown token (404) and offers retry", async () => {
    mockFetch({ [`/api/token/${MINT_A}`]: json({ error: "The data provider has no data for that address." }, 404) });
    await renderToken(MINT_A);
    expect(await screen.findByRole("alert")).toHaveTextContent("no data for that address");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByTestId("chart")).not.toBeInTheDocument();
  });
});
