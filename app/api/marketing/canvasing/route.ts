import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, getUserPermissions } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/auth-helpers";
import { apiSuccess, ApiErrors, apiError } from "@/lib/api-response";
import { ErrorCodes } from "@/lib/api";
import {
  isCanvasingListRouteFailure,
  marketingCanvasingListRouteService,
  type CanvasingListRouteFailure,
} from "@/modules/marketing";

function mapListFailure(result: CanvasingListRouteFailure) {
  if (result.status === 404) return ApiErrors.notFound(result.error);
  if (result.status === 403) return ApiErrors.forbidden(result.error);
  if (result.status === 400) {
    return apiError(result.error, result.code ?? ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }
  return ApiErrors.internalError(result.error);
}

export async function GET(req: NextRequest) {
  const session = await verifyAuth(req);
  if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

  const { searchParams } = new URL(req.url);
  const result = await marketingCanvasingListRouteService.list({
    session,
    permissions: await getUserPermissions(session.id),
    isSuperAdmin: isSuperAdminRole(session.role),
    status: searchParams.get("status"),
    salesId: searchParams.get("salesId"),
    siteId: searchParams.get("siteId"),
    search: searchParams.get("search"),
    page: parseInt(searchParams.get("page") || "1", 10),
    limit: parseInt(searchParams.get("limit") || "10", 10),
    cursor: searchParams.get("cursor"),
  });

  if (isCanvasingListRouteFailure(result)) return mapListFailure(result);
  // Why: response shape adalah API contract (lihat useCanvasingListQuery di
  // app/admin/marketing/canvasing). Client baca data/total/summary di
  // top-level, bukan di-wrap apiSuccess. Tetap pertahankan agar tidak
  // breaking.
  return NextResponse.json(result.data);
}

export async function POST(req: NextRequest) {
  const session = await verifyAuth(req);
  if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

  const body = (await req.json()) as Record<string, unknown>;
  const result = await marketingCanvasingListRouteService.create({
    session,
    permissions: session.permissions ?? (await getUserPermissions(session.id)),
    isSuperAdmin: isSuperAdminRole(session.role),
    body,
  });

  if (isCanvasingListRouteFailure(result)) return mapListFailure(result);
  return apiSuccess(result.data, { status: result.status ?? 201 });
}
