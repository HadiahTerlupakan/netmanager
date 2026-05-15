import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getInvestorAuth } from "@/lib/auth/investor-auth";
import { getInvestorPortalProjectService } from "@/modules/investor";
import { isRouteServiceError } from "@/lib/api/route-service-error";

/** Mengambil detail proyek investor dari service finance. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getInvestorAuth();
    if (!auth) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await getInvestorPortalProjectService().getProjectDetail(
      id,
      auth.id,
      auth.tenantId,
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
