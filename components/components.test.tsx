import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TokenRow from "@/components/TokenRow";
import WatchButton from "@/components/WatchButton";
import SavedWalletRow from "@/components/SavedWalletRow";
import Freshness from "@/components/Freshness";
import TokenAvatar from "@/components/TokenAvatar";
import { MAX_WATCHLIST, savedWallets, watchlist } from "@/lib/stores";
import type { TrendingToken } from "@/types/solana";

const MINT = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const WALLET = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";

const token: TrendingToken = {
  mint: MINT,
  name: "Alpha Coin",
  symbol: "ALP",
  image: null,
  priceUsd: 0.00001234,
  change1h: 3.5,
  change24h: -12.25,
  marketCapUsd: 2_500_000,
  liquidityUsd: 1000,
};

beforeEach(() => {
  localStorage.clear();
  watchlist.clear();
  savedWallets.clear();
});
afterEach(() => vi.useRealTimers());

describe("TokenRow", () => {
  it("shows formatted values and links to the token page", () => {
    render(<TokenRow token={token} index={0} />);
    expect(screen.getByRole("link", { name: "Alpha Coin" })).toHaveAttribute("href", `/token/${MINT}`);
    expect(screen.getByText("$0.00001234")).toBeInTheDocument();
    expect(screen.getByText("+3.50%")).toHaveClass("change-up");
    expect(screen.getByText("-12.25%")).toHaveClass("change-down");
    expect(screen.getByText("$2.50M")).toBeInTheDocument();
  });

  it("shows an em dash for missing numbers", () => {
    render(<TokenRow token={{ ...token, priceUsd: null, change24h: null }} index={4} />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("05")).toBeInTheDocument();
  });

  it("keeps the watch button outside the link (no interactive nesting)", () => {
    const { container } = render(<TokenRow token={token} index={0} />);
    expect(container.querySelector("a button, button a")).toBeNull();
    expect(screen.getByRole("button", { name: /Add Alpha Coin to watchlist/ })).toBeInTheDocument();
  });
});

describe("TokenAvatar", () => {
  it("falls back to initials when the image fails to load", () => {
    const { container } = render(<TokenAvatar image="https://bad.example/x.png" symbol="alp" />);
    const img = container.querySelector("img")!;
    expect(img).toBeInTheDocument();
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });
});

describe("WatchButton", () => {
  it("adds and removes a token, persisting it", async () => {
    const user = userEvent.setup();
    render(<WatchButton token={token} />);
    const button = screen.getByRole("button", { name: /Add Alpha Coin/ });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAccessibleName(/Remove Alpha Coin from watchlist/);
    expect(JSON.parse(localStorage.getItem("solana-dashboard:watchlist:v1")!)).toMatchObject([
      { mint: MINT, name: "Alpha Coin", symbol: "ALP" },
    ]);

    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(watchlist.getSnapshot()).toHaveLength(0);
  });

  it("shows the persisted state on first render (returning visitor)", () => {
    watchlist.add({ mint: MINT, name: "Alpha Coin", symbol: "ALP", image: null, addedAt: 1 });
    render(<WatchButton token={token} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("tells the user when the watchlist is full instead of failing silently", async () => {
    const user = userEvent.setup();
    for (let i = 0; i < MAX_WATCHLIST; i++) {
      watchlist.add({ mint: `m${i}`, name: `n${i}`, symbol: "S", image: null, addedAt: i });
    }
    render(<WatchButton token={token} variant="full" />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Watchlist full")).toBeInTheDocument();
    expect(watchlist.has(MINT)).toBe(false);
  });
});

describe("SavedWalletRow (autosave)", () => {
  beforeEach(() => {
    savedWallets.add({ address: WALLET, label: "", savedAt: 1 });
  });

  it("saves the label shortly after typing stops and confirms it", () => {
    vi.useFakeTimers();
    render(<SavedWalletRow wallet={savedWallets.getSnapshot()[0]} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "Main" } });
    fireEvent.change(input, { target: { value: "Main wallet" } });
    expect(savedWallets.getSnapshot()[0].label).toBe(""); // not yet - debounced

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(savedWallets.getSnapshot()[0].label).toBe("Main wallet");
    expect(screen.getByText("Saved ✓")).toBeInTheDocument();
  });

  it("saves immediately on blur", () => {
    render(<SavedWalletRow wallet={savedWallets.getSnapshot()[0]} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Cold storage" } });
    fireEvent.blur(input);
    expect(savedWallets.getSnapshot()[0].label).toBe("Cold storage");
  });

  it("does not lose an edit if the user navigates away mid-debounce", () => {
    vi.useFakeTimers();
    const { unmount } = render(<SavedWalletRow wallet={savedWallets.getSnapshot()[0]} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Unsaved edit" } });
    unmount();
    expect(savedWallets.getSnapshot()[0].label).toBe("Unsaved edit");
  });

  it("caps label length and can remove the wallet", async () => {
    const user = userEvent.setup();
    render(<SavedWalletRow wallet={savedWallets.getSnapshot()[0]} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "40");
    await user.click(screen.getByRole("button", { name: /Remove saved wallet/ }));
    expect(savedWallets.getSnapshot()).toHaveLength(0);
  });
});

describe("Freshness", () => {
  it("shows age, and a refresh button that calls back", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(<Freshness updatedAt={Date.now() - 30_000} isRefreshing={false} onRefresh={onRefresh} />);
    expect(screen.getByText(/Updated 30s ago/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh data" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("disables refresh while refreshing and warns when a refresh failed", () => {
    const { rerender } = render(<Freshness updatedAt={Date.now()} isRefreshing onRefresh={() => {}} />);
    expect(screen.getByRole("button", { name: "Refresh data" })).toBeDisabled();
    expect(screen.getByText("Refreshing…")).toBeInTheDocument();

    rerender(<Freshness updatedAt={Date.now() - 90_000} isRefreshing={false} error="offline" onRefresh={() => {}} />);
    const status = screen.getByText(/Couldn't refresh/);
    expect(status).toHaveTextContent("showing data from 1m ago");
  });
});
