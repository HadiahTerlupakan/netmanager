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

async function buildDetailInput(req: NextRequest, id: string) {
  const session = await verifyAuth(req);
  if (!session) return null;
  return {
    id,
    session,
    permissions: await getUserPermissions(session.id),
    isSuperAdmin: isSuperAdminRole(session.role),
  };
}

// GET - Get detail claim
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const input = await buildDetailInput(req, id);
  if (!input) return ApiErrors.unauthorized("Session tidak valid");

  const result = await marketingPointClaimRouteService.getDetail(input);
  if (isPointClaimRouteFailure(result)) return mapClaimRouteFailure(result);
  return apiSuccess(result.data);
}

// PUT - Admin approve/reject claim
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const input = await buildDetailInput(req, id);
  if (!input) return ApiErrors.unauthorized("Session tidak valid");

  const body = (await req.json()) as { action?: string; notes?: string };
  if (body.action !== "approve" && body.action !== "reject") {
    return apiError(
      "Action tidak valid. Gunakan approve atau reject",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const result = await marketingPointClaimRouteService.review({
    ...input,
    action: body.action,
    notes: body.notes,
  });

  if (isPointClaimRouteFailure(result)) return mapClaimRouteFailure(result);
  return apiSuccess(result.data, {
    ...(result.message ? { message: result.message } : {}),
  });
}

// DELETE - Admin delete claim
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const input = await buildDetailInput(req, id);
  if (!input) return ApiErrors.unauthorized("Session tidak valid");

  const result = await marketingPointClaimRouteService.delete(input);
  if (isPointClaimRouteFailure(result)) return mapClaimRouteFailure(result);
  return apiSuccess(null, {
    ...(result.message ? { message: result.message } : {}),
  });
}
