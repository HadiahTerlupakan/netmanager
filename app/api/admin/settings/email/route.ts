import { z } from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getEmailSettings, updateEmailSettings } from "@/modules/settings";

const emailSettingsUpdateSchema = z.object({
  smtpHost: z.string().trim().min(1, "SMTP host wajib diisi"),
  smtpPort: z.string().trim().regex(/^\d+$/, "Port SMTP harus berupa angka"),
  smtpUser: z.string().trim().email("SMTP user harus berupa email valid"),
  smtpPass: z.string().optional(),
  fromName: z.string().trim().min(1, "From name wajib diisi"),
  fromEmail: z.string().trim().email("From email harus valid"),
});

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
  {
    auth: true,
    permissions: ["email:update"],
    schema: emailSettingsUpdateSchema,
  },
  async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    await updateEmailSettings(tenantId, ctx.session!.user.id, ctx.validated);

    return apiSuccess(null, { message: "Pengaturan email berhasil disimpan" });
  },
);
