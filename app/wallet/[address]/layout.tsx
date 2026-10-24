import type { Metadata } from "next";
import { truncateAddress } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  return { title: `Wallet ${truncateAddress(address, 4)}` };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
