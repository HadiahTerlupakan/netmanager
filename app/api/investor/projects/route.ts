import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getInvestorAuth } from "@/lib/auth/investor-auth";
import { getInvestorPortalProjectService } from "@/modules/investor";

/** Mengambil daftar proyek investor dari service finance. */
export async function GET() {
  try {
    const auth = await getInvestorAuth();
    if (!auth) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const projects = await getInvestorPortalProjectService().getProjects(
      auth.id,
      auth.tenantId,
    );
    return NextResponse.json({ projects }, { status: 200 });
  } catch (error) {
    logger.error("[INVESTOR_PROJECTS] Error:", error);
    return NextResponse.json({ message: "Terjadi kesalahan" }, { status: 500 });
  }
}
