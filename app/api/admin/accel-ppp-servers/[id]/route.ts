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
  accelPppServerUpdateSchema,
} from "@/modules/network";
import * as z from "zod";
import { mapAccelPppErrorToResponse } from "../_helpers";

async function guard(action: string) {
  await requireFullRadiusMode();
  if (!(await hasPermission(`accel_ppp:${action}`))) {
    return ApiErrors.forbidden("Akses ditolak");
  }
  return null;
}

/** GET /api/admin/accel-ppp-servers/[id] */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  try {
    const denied = await guard("read");
    if (denied) return denied;
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }

  const id = ctx.params.id;
  const tenantId = ctx.session!.user.tenantId ?? null;
  const service = new AccelPppServerService();
  try {
    const server = await service.getById(id, tenantId);
    return apiSuccess(server);
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
});

/** PATCH /api/admin/accel-ppp-servers/[id] */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  try {
    const denied = await guard("update");
    if (denied) return denied;
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }

  const body = await req.json();
  const parsed = accelPppServerUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Data tidak valid", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
      details: z.flattenError(parsed.error),
    });
  }

  const id = ctx.params.id;
  const user = ctx.session!.user;
  const service = new AccelPppServerService();
  try {
    const updated = await service.update(
      id,
      parsed.data,
      user.tenantId ?? null,
      user.id,
    );
    return apiSuccess(updated);
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
});

/** DELETE /api/admin/accel-ppp-servers/[id]?force=true */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  try {
    const denied = await guard("delete");
    if (denied) return denied;
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }

  const id = ctx.params.id;
  const user = ctx.session!.user;
  const force = req.nextUrl.searchParams.get("force") === "true";
  const service = new AccelPppServerService();
  try {
    await service.delete(id, user.tenantId ?? null, user.id, { force });
    return apiSuccess({ deleted: true });
  } catch (error) {
    const mapped = mapAccelPppErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
});
