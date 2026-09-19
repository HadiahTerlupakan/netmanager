import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { ensureMitraInScope, ensureSiteIdInScope } from "@/lib/api/guards";
import { updateMitraSchema } from "@/lib/validations/mitra";
import {
  broadcastMitraProfileRefreshSafely,
  getMitraService,
} from "@/modules/mitra";
import * as z from "zod";

const patchSchema = updateMitraSchema;

export const GET = createHandler(
  {
    auth: true,
    permissions: ["mitra:read"],
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const access = await ensureMitraInScope(id, user, ctx.permissions);
    if (!access.allowed) {
      return ApiErrors.forbidden(access.error);
    }

    const result = await getMitraService().getMitraById(
      id,
      user.tenantId ?? undefined,
    );
    if (!result.success) {
      return ApiErrors.notFound(result.error);
    }

    return apiSuccess(result.data);
  },
);

export const PUT = createHandler(
  {
    auth: true,
    permissions: ["mitra:update"],
    schema: patchSchema as unknown as z.ZodType<z.infer<typeof patchSchema>>,
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const access = await ensureMitraInScope(id, user, ctx.permissions);
    if (!access.allowed) {
      return ApiErrors.forbidden(access.error);
    }

    const siteCheck = ensureSiteIdInScope(
      user,
      ctx.permissions,
      ctx.validated.siteId,
    );
    if (!siteCheck.valid) {
      return ApiErrors.forbidden(siteCheck.error);
    }

    const result = await getMitraService().updateMitra(
      id,
      { ...ctx.validated, tenantId: user.tenantId ?? undefined },
      user.id,
    );

    if (!result.success) {
      return ApiErrors.badRequest(result.error);
    }

    return apiSuccess(undefined);
  },
);

export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["mitra:delete"],
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const access = await ensureMitraInScope(id, user, ctx.permissions);
    if (!access.allowed) {
      return ApiErrors.forbidden(access.error);
    }

    const result = await getMitraService().deleteMitra(
      id,
      user.id,
      user.tenantId ?? undefined,
    );
    if (!result.success) {
      return ApiErrors.badRequest(result.error);
    }

    return apiSuccess(undefined);
  },
);

export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["mitra:update"],
    schema: patchSchema as unknown as z.ZodType<z.infer<typeof patchSchema>>,
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const access = await ensureMitraInScope(id, user, ctx.permissions);
    if (!access.allowed) {
      return ApiErrors.forbidden(access.error);
    }

    const siteCheck = ensureSiteIdInScope(
      user,
      ctx.permissions,
      ctx.validated.siteId,
    );
    if (!siteCheck.valid) {
      return ApiErrors.forbidden(siteCheck.error);
    }

    const result = await getMitraService().updateMitra(
      id,
      { ...ctx.validated, tenantId: user.tenantId ?? undefined },
      user.id,
    );

    if (!result.success) {
      return ApiErrors.badRequest(result.error);
    }

    broadcastMitraProfileRefreshSafely(id);

    return apiSuccess(undefined);
  },
);
