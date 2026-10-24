import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet lookup",
  description: "Inspect any Solana wallet's SOL and token holdings.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
