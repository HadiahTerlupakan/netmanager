import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getWhatsAppSettings,
  testWhatsAppSettings,
  updateWhatsAppSettings,
  type WhatsAppSettingsUpdatePayload,
} from "@/modules/settings";
import { z } from "zod";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const tenantId = ctx.session!.user.tenantId;

  if (!(await hasPermission("whatsapp:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat pengaturan WhatsApp",
    );
  }

  const payload = await getWhatsAppSettings(tenantId);
  return apiSuccess(payload);
});

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const tenantId = ctx.session!.user.tenantId;

  if (!(await hasPermission("whatsapp:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah pengaturan WhatsApp",
    );
  }

  const body = (await req.json()) as WhatsAppSettingsUpdatePayload;
  await updateWhatsAppSettings(tenantId, body);

  return apiSuccess(null, { message: "Pengaturan WhatsApp berhasil disimpan" });
});

const WHATSAPP_TEST_SCHEMA = z.object({
  phone: z
    .string()
    .trim()
    .min(8, "Nomor telepon terlalu pendek")
    .regex(/^\+?[0-9]+$/, "Nomor hanya boleh berisi angka dan tanda +"),
});

export const POST = createHandler<z.infer<typeof WHATSAPP_TEST_SCHEMA>>(
  {
    auth: true,
    schema: WHATSAPP_TEST_SCHEMA,
  },
  async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId;

    if (!(await hasPermission("whatsapp:update"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengirim pesan percobaan WhatsApp",
      );
    }

    const { phone } = ctx.validated;
    const result = await testWhatsAppSettings(tenantId, phone);

    if (result.source === "system") {
      return ApiErrors.internalError(result.message);
    }

    return apiSuccess(
      {
        success: result.success,
        message: result.message,
      },
      { status: result.success ? 200 : 502 },
    );
  },
);
