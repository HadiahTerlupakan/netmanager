import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { requireFullRadiusMode } from "@/lib/security/requireFullRadiusMode";
import {
  AccelPppServerService,
  accelPppServerCreateSchema,
  accelPppServerListQuerySchema,
} from "@/modules/network";
import * as z from "zod";
import { mapAccelPppErrorToResponse } from "./_helpers";

/** GET /api/admin/accel-ppp-servers — list dgn filter ringan. */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  try {
    await requireFullRadiusMode();
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }

  if (!(await hasPermission("accel_ppp:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const { searchParams } = req.nextUrl;
  const parsed = accelPppServerListQuerySchema.safeParse({
    search: searchParams.get("search") ?? undefined,
    siteId: searchParams.get("siteId") ?? undefined,
    pingStatus: searchParams.get("pingStatus") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("Filter tidak valid", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
      details: z.flattenError(parsed.error),
    });
  }

  const tenantId = ctx.session!.user.tenantId ?? null;
  const service = new AccelPppServerService();
  const items = await service.list(tenantId, parsed.data);
  return apiSuccess({ items });
});

/** POST /api/admin/accel-ppp-servers — registrasi server baru. */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  try {
    await requireFullRadiusMode();
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }

  if (!(await hasPermission("accel_ppp:create"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const body = await req.json();
  const parsed = accelPppServerCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Data tidak valid", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
      details: z.flattenError(parsed.error),
    });
  }

  const user = ctx.session!.user;
  const service = new AccelPppServerService();
  try {
    const created = await service.create(
      { ...parsed.data, tenantId: user.tenantId ?? null },
      user.id,
    );
    return apiSuccess({ id: created.id }, { status: 201 });
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
});
