import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getInvestorPortalPayoutService } from "@/modules/finance";

function getSecret(): Uint8Array {
  const raw = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!raw) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return new TextEncoder().encode(raw);
}

/** Mengambil daftar payout investor dari service finance. */
export async function GET(request: Request) {
  try {
    const token = (await cookies()).get("investor_auth_token")?.value;
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, getSecret());
    const response = await getInvestorPortalPayoutService().getPayouts(
      payload.id as string,
      new URL(request.url).searchParams,
    );
    return NextResponse.json(response);
  } catch (error: unknown) {
    logger.error("Get Payouts error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    const status = errorMessage.includes("Permission") ? 403 : 500;
    return NextResponse.json({ message: errorMessage }, { status });
  }
}
