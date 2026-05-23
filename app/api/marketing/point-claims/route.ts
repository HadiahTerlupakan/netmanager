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

// GET - List all claims (admin) atau claims by sales (mobile)
export async function GET(req: NextRequest) {
  const session = await verifyAuth(req);
  if (!session) return ApiErrors.unauthorized("Session tidak valid");

  const { searchParams } = new URL(req.url);
  const result = await marketingPointClaimRouteService.list({
    session,
    permissions: await getUserPermissions(session.id),
    isSuperAdmin: isSuperAdminRole(session.role),
    status: searchParams.get("status") ?? undefined,
    salesId: searchParams.get("salesId") ?? undefined,
  });

  if (isPointClaimRouteFailure(result)) return mapClaimRouteFailure(result);
  return apiSuccess(result.data);
}
