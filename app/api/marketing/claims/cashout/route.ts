import { NextRequest } from "next/server";
import { verifyAuth } from "@/lib/auth";
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

/** Cash out accumulated approved point claims for the authenticated sales user. */
export async function POST(req: NextRequest) {
  const session = await verifyAuth(req);
  if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

  const result = await marketingPointClaimRouteService.cashout({ session });
  if (isPointClaimRouteFailure(result)) return mapClaimRouteFailure(result);

  return apiSuccess(result.data, {
    status: 200,
    ...(result.message ? { message: result.message } : {}),
  });
}
