import { badRequest, respond } from "@/lib/api";
import { fetchWalletPortfolio, TTL } from "@/lib/solanaTracker";
import { isValidSolanaAddress } from "@/lib/validate";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!isValidSolanaAddress(address)) {
    return badRequest("That doesn't look like a valid Solana wallet address.");
  }

  return respond(
    "/api/wallet/:address",
    TTL.wallet,
    () => fetchWalletPortfolio(address),
    (wallet, fetchedAt) => ({ wallet, fetchedAt })
  );
}
