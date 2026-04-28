import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getInvestorPortalProjectService } from "@/modules/finance";

function getSecret(): Uint8Array {
  const raw = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!raw) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return new TextEncoder().encode(raw);
}

/** Mengambil daftar proyek investor dari service finance. */
export async function GET() {
  try {
    const token = (await cookies()).get("investor_auth_token")?.value;
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, getSecret());
    const projects = await getInvestorPortalProjectService().getProjects(
      payload.id as string,
    );
    return NextResponse.json({ projects }, { status: 200 });
  } catch (error) {
    logger.error("[INVESTOR_PROJECTS] Error:", error);
    return NextResponse.json({ message: "Terjadi kesalahan" }, { status: 500 });
  }
}
