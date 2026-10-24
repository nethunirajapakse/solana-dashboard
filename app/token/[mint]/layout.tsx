import type { Metadata } from "next";
import { truncateAddress } from "@/lib/format";

// Deliberately uses only the URL (no upstream call): crawlers and link
// unfurlers hit this too, and the provider's free quota is small.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ mint: string }>;
}): Promise<Metadata> {
  const { mint } = await params;
  return { title: `Token ${truncateAddress(mint, 4)}` };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
