import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Tokens you follow, with live prices.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
