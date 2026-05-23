import { NextRequest } from "next/server";
import { verifyAuth, getUserPermissions } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/auth-helpers";
import {
  isPointClaimRouteFailure,
  marketingPointClaimRouteService,
  type PointClaimRouteFailure,
} from "@/modules/marketing";
import {
  apiSuccess,
  ApiErrors,
  apiError,
  ErrorCodes,
} from "@/lib/api-response";

function mapClaimRouteFailure(result: PointClaimRouteFailure) {
  if (result.status === 404) return ApiErrors.notFound(result.error);
  if (result.status === 403) return ApiErrors.forbidden(result.error);
  if (result.status === 400) {
    return apiError(result.error, result.code ?? ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }
  return ApiErrors.internalError(result.error);
}

// POST - Sales submit claim dengan bukti
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifyAuth(req);
  if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

  const { id: canvasingId } = await params;
  const body = (await req.json()) as {
    buktiUrls?: string[];
    buktiMetadata?: Record<string, unknown>;
    keterangan?: string;
  };

  const result = await marketingPointClaimRouteService.submit({
    session,
    permissions: await getUserPermissions(session.id),
    isSuperAdmin: isSuperAdminRole(session.role),
    canvasingId,
    buktiUrls: body.buktiUrls ?? [],
    buktiMetadata: body.buktiMetadata,
    keterangan: body.keterangan,
  });

  if (isPointClaimRouteFailure(result)) return mapClaimRouteFailure(result);
  return apiSuccess(result.data, {
    status: result.status ?? 200,
    ...(result.message ? { message: result.message } : {}),
  });
}

// GET - Get claim for specific canvasing
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifyAuth(req);
  if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

  const { id: canvasingId } = await params;

  const result = await marketingPointClaimRouteService.getByCanvasing({
    session,
    permissions: await getUserPermissions(session.id),
    isSuperAdmin: isSuperAdminRole(session.role),
    canvasingId,
  });

  if (isPointClaimRouteFailure(result)) return mapClaimRouteFailure(result);
  return apiSuccess(result.data);
}
