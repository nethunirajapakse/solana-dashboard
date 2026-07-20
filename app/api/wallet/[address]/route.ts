import { NextResponse } from "next/server";
import { fetchWalletPortfolio } from "@/lib/solanaTracker";
import { isValidSolanaAddress } from "@/lib/validate";

export async function GET(
  _request: Request,
  { params }: { params: { address: string } }
) {
  const { address } = params;

  if (!isValidSolanaAddress(address)) {
    return NextResponse.json(
      { error: "That doesn't look like a valid Solana wallet address." },
      { status: 400 }
    );
  }

  try {
    const wallet = await fetchWalletPortfolio(address);
    return NextResponse.json(wallet);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/wallet/:address]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
