import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getMitraService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";
import { updateMitraSchema } from "@/lib/validations/mitra";
import * as z from "zod";

const patchSchema = updateMitraSchema;

async function ensureMitraInScope(
  mitraId: string,
  user: { id: string; name?: string },
): Promise<{ allowed: boolean; error?: string }> {
  const { isRestricted, siteIds } = checkSiteRestriction(
    { user } as never,
    "mitra",
  );
  if (!isRestricted) return { allowed: true };

  const mitra = await getMitraService().getMitraById(mitraId);
  if (!mitra.success) return { allowed: false, error: "Mitra tidak ditemukan" };

  if (!mitra.data.siteId || !siteIds.includes(mitra.data.siteId)) {
    return {
      allowed: false,
      error: "Anda tidak dapat mengakses mitra di luar scope Anda",
    };
  }

  return { allowed: true };
}

function ensureSiteIdInScope(
  user: { id: string; name?: string },
  newSiteId?: string,
): { valid: boolean; error?: string } {
  if (!newSiteId) return { valid: true };
  const { isRestricted, siteIds } = checkSiteRestriction(
    { user } as never,
    "mitra",
  );
  if (isRestricted && !siteIds.includes(newSiteId)) {
    return {
      valid: false,
      error: "Anda tidak dapat memindahkan mitra ke site di luar scope Anda",
    };
  }

  return { valid: true };
}

export const GET = createHandler(
  {
    auth: true,
    permissions: ["mitra:read"],
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const user = ctx.session!.user;

    const access = await ensureMitraInScope(id, user);
    if (!access.allowed) {
      return ApiErrors.forbidden(access.error);
    }

    const result = await getMitraService().getMitraById(id);
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

    const access = await ensureMitraInScope(id, user);
    if (!access.allowed) {
      return ApiErrors.forbidden(access.error);
    }

    const siteCheck = ensureSiteIdInScope(user, ctx.validated.siteId);
    if (!siteCheck.valid) {
      return ApiErrors.forbidden(siteCheck.error);
    }

    const result = await getMitraService().updateMitra(
      id,
      ctx.validated,
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

    const access = await ensureMitraInScope(id, user);
    if (!access.allowed) {
      return ApiErrors.forbidden(access.error);
    }

    const result = await getMitraService().deleteMitra(id, user.id);
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

    const access = await ensureMitraInScope(id, user);
    if (!access.allowed) {
      return ApiErrors.forbidden(access.error);
    }

    const siteCheck = ensureSiteIdInScope(user, ctx.validated.siteId);
    if (!siteCheck.valid) {
      return ApiErrors.forbidden(siteCheck.error);
    }

    const result = await getMitraService().updateMitra(
      id,
      ctx.validated,
      user.id,
    );

    if (!result.success) {
      return ApiErrors.badRequest(result.error);
    }

    const { socketEmitter } = await import("@/lib/websocket/emitter");
    socketEmitter.profileRefresh(id);

    return apiSuccess(undefined);
  },
);
