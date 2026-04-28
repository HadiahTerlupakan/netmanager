import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import {
  getInvestorPortalProjectService,
  isRouteServiceError,
} from "@/modules/finance";

function getSecret(): Uint8Array {
  const raw = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!raw) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return new TextEncoder().encode(raw);
}

/** Mengambil detail proyek investor dari service finance. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = (await cookies()).get("investor_auth_token")?.value;
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { payload } = await jwtVerify(token, getSecret());
    const project = await getInvestorPortalProjectService().getProjectDetail(
      id,
      payload.id as string,
    );
    return NextResponse.json({ project }, { status: 200 });
  } catch (error) {
    if (isRouteServiceError(error)) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    logger.error("[INVESTOR_PROJECT_DETAIL] Error:", error);
    return NextResponse.json({ message: "Terjadi kesalahan" }, { status: 500 });
  }
}
