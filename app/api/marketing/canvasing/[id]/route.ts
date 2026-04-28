import { NextRequest } from "next/server";
import { verifyAuth, getUserPermissions } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/auth-helpers";
import {
  marketingCanvasingDetailRouteService,
  type MarketingCanvasingDetailRouteResult,
} from "@/modules/marketing";
import { apiSuccess, ApiErrors, apiError } from "@/lib/api-response";

type MarketingCanvasingDetailFailure = Extract<
  MarketingCanvasingDetailRouteResult<unknown>,
  { success: false }
>;

function isMarketingCanvasingDetailFailure(
  result: MarketingCanvasingDetailRouteResult<unknown>,
): result is MarketingCanvasingDetailFailure {
  return !result.success;
}

function mapCanvasingRouteFailure(result: MarketingCanvasingDetailFailure) {
  if (result.status === 404) return ApiErrors.notFound(result.error);
  if (result.status === 403) return ApiErrors.forbidden(result.error);
  if (result.status === 400 && result.code) {
    return apiError(result.error, result.code, { status: 400 });
  }
  if (result.status === 400) return ApiErrors.badRequest(result.error);

  return ApiErrors.internalError(result.error);
}

async function buildCanvasingRouteInput(req: NextRequest, id: string) {
  const session = await verifyAuth(req);
  if (!session) return null;

  return {
    id,
    session,
    permissions: await getUserPermissions(session.id),
    isSuperAdmin: isSuperAdminRole(session.role),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const input = await buildCanvasingRouteInput(req, id);
  if (!input) return ApiErrors.unauthorized("Tidak terautentikasi");

  const result = await marketingCanvasingDetailRouteService.getDetail(input);
  if (isMarketingCanvasingDetailFailure(result)) {
    return mapCanvasingRouteFailure(result);
  }

  return apiSuccess(result.data);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const input = await buildCanvasingRouteInput(req, id);
  if (!input) return ApiErrors.unauthorized("Tidak terautentikasi");

  const result = await marketingCanvasingDetailRouteService.updateDetail({
    ...input,
    body: await req.json(),
  });
  if (isMarketingCanvasingDetailFailure(result)) {
    return mapCanvasingRouteFailure(result);
  }

  return apiSuccess(result.data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const input = await buildCanvasingRouteInput(req, id);
  if (!input) return ApiErrors.unauthorized("Tidak terautentikasi");

  const result = await marketingCanvasingDetailRouteService.patchDetail({
    ...input,
    body: await req.json(),
  });
  if (isMarketingCanvasingDetailFailure(result)) {
    return mapCanvasingRouteFailure(result);
  }

  return apiSuccess(result.data, {
    ...(result.message ? { message: result.message } : {}),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const input = await buildCanvasingRouteInput(req, id);
  if (!input) return ApiErrors.unauthorized("Tidak terautentikasi");

  const result = await marketingCanvasingDetailRouteService.deleteDetail(input);
  if (isMarketingCanvasingDetailFailure(result)) {
    return mapCanvasingRouteFailure(result);
  }

  return apiSuccess(result.data, {
    ...(result.message ? { message: result.message } : {}),
  });
}
