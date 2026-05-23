import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getEmailSettings,
  updateEmailSettings,
  type EmailSettingsUpdatePayload,
} from "@/modules/settings";

export const GET = createHandler(
  { auth: true, permissions: ["email:read"] },
  async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const payload = await getEmailSettings(tenantId);
    return apiSuccess(payload);
  },
);

export const PUT = createHandler(
  { auth: true, permissions: ["email:update"] },
  async (req, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const payload = (await req.json()) as EmailSettingsUpdatePayload;
    await updateEmailSettings(tenantId, ctx.session!.user.id, payload);

    return apiSuccess(null, { message: "Pengaturan email berhasil disimpan" });
  },
);
