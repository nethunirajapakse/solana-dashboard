import { badRequest, respond } from "@/lib/api";
import { fetchTokenDetails, TTL } from "@/lib/solanaTracker";
import { isValidSolanaAddress } from "@/lib/validate";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params;

  if (!isValidSolanaAddress(mint)) {
    return badRequest("That doesn't look like a valid Solana token mint address.");
  }

  return respond(
    "/api/token/:mint",
    TTL.token,
    () => fetchTokenDetails(mint),
    (token, fetchedAt) => ({ token, fetchedAt })
  );
}
