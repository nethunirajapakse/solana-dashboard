import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phantom wallet",
  description: "Connect Phantom (read-only) to open your own portfolio.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
