import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Solana Dashboard",
  description: "Trending Solana tokens and wallet lookup, powered by SolanaTracker.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
