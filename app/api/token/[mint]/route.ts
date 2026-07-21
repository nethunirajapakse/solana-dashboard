import { NextResponse } from "next/server";
import { fetchTokenDetails } from "@/lib/solanaTracker";
import { isValidSolanaAddress } from "@/lib/validate";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;

  if (!isValidSolanaAddress(mint)) {
    return NextResponse.json(
      { error: "That doesn't look like a valid Solana token mint address." },
      { status: 400 }
    );
  }

  try {
    const token = await fetchTokenDetails(mint);
    return NextResponse.json(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/token/:mint]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
