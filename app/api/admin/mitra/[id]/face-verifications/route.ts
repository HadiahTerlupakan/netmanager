import { NextRequest, NextResponse } from "next/server";
import { hasPermission, getCurrentUser } from "@/lib/rbac";
import { getMitraService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";

function getMitraRouteService() {
  return getMitraService();
}

async function validateMitraAccess(
  mitraId: string,
  user: { id: string; name?: string | null },
): Promise<{ allowed: boolean; error?: string }> {
  const { isRestricted, siteIds } = checkSiteRestriction(
    { user } as never,
    "mitra",
  );
  if (!isRestricted) return { allowed: true };

  const mitra = await getMitraRouteService().getMitraById(mitraId);
  if (!mitra.success) return { allowed: false, error: "Mitra tidak ditemukan" };

  if (!mitra.data.siteId || !siteIds.includes(mitra.data.siteId)) {
    return {
      allowed: false,
      error: "Anda tidak dapat mengakses mitra di luar scope Anda",
    };
  }

  return { allowed: true };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (
    !user ||
    !user.id ||
    !(await hasPermission("mitra:read", user, { silent: true }))
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 },
    );
  }

  const { id } = await params;

  const access = await validateMitraAccess(id, {
    id: user.id,
    name: user.name,
  });
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const result = await getMitraRouteService().getFaceVerificationLogs(
    id,
    user.tenantId as string,
    page,
    limit,
  );

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
