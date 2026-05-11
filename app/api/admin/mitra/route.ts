import { NextRequest, NextResponse } from "next/server";
import { hasPermission, getCurrentUser } from "@/lib/rbac";
import { getMitraService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";

type EmployeeTypeValue = "KARYAWAN";

function getMitraRouteService() {
  return getMitraService();
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission("mitra:read", user, { silent: true }))) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const employeeType = searchParams.get("type") as
    | EmployeeTypeValue
    | undefined;
  const isActive =
    searchParams.get("active") !== null
      ? searchParams.get("active") === "true"
      : undefined;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const { isRestricted, siteIds } = checkSiteRestriction(
    { user } as never,
    "mitra",
  );
  const allowedSiteIds = isRestricted ? siteIds : undefined;

  const result = await getMitraRouteService().getMitras(
    { search, employeeType, isActive, allowedSiteIds },
    page,
    limit,
  );

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await hasPermission("mitra:create", user, { silent: true }))) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();

    const { isRestricted, siteIds } = checkSiteRestriction(
      { user } as never,
      "mitra",
    );
    if (isRestricted && body.siteId && !siteIds.includes(body.siteId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Anda tidak dapat membuat mitra untuk site di luar scope Anda",
        },
        { status: 403 },
      );
    }

    const result = await getMitraRouteService().createMitra(body, user.id!);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }
}
