import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import { logoDeleteSchema, logoTypeSchema } from "@/lib/validations/settings";
import { getLogoSettings, uploadLogo, deleteLogo } from "@/modules/settings";

/**
 * GET /api/settings/logo
 * Mengambil pengaturan logo
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("logo:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat pengaturan logo",
    );
  }

  return apiSuccess(await getLogoSettings(ctx.session?.user?.tenantId ?? null));
});

/**
 * POST /api/settings/logo
 * Upload logo baru
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("logo:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah pengaturan logo",
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const parsedType = logoTypeSchema.safeParse(formData.get("type"));

  if (!file) {
    return ApiErrors.badRequest("File tidak ditemukan");
  }

  if (!parsedType.success) {
    return ApiErrors.badRequest("Type harus invoice, aplikasi, atau landing");
  }
  const type = parsedType.data;
  const normalizedPath = await uploadLogo(
    type,
    file,
    ctx.session?.user?.tenantId ?? null,
  );
  const settingKey =
    type === "invoice"
      ? "LOGO_INVOICE"
      : type === "aplikasi"
        ? "LOGO_APLIKASI"
        : "LOGO_LANDING_PAGE";

  // System Log
  if (ctx.session?.user?.id) {
    logActivitySafe({
      action: "UPDATE",
      subject: "Settings",
      userId: ctx.session.user.id,
      details: { key: settingKey, value: normalizedPath },
    });
  }

  return apiSuccess({
    success: true,
    logoPath: normalizedPath,
  });
});

/**
 * DELETE /api/settings/logo
 * Hapus logo
 */
export const DELETE = createHandler<{
  type: "invoice" | "aplikasi" | "landing";
}>(
  {
    auth: true,
    schema: logoDeleteSchema,
  },
  async (_req, ctx) => {
    if (!(await hasPermission("logo:update"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah pengaturan logo",
      );
    }

    const { type } = ctx.validated;

    const settingKey =
      type === "invoice"
        ? "LOGO_INVOICE"
        : type === "aplikasi"
          ? "LOGO_APLIKASI"
          : "LOGO_LANDING_PAGE";
    await deleteLogo(type, ctx.session?.user?.tenantId ?? null);

    // System Log
    if (ctx.session?.user?.id) {
      logActivitySafe({
        action: "DELETE",
        subject: "Settings",
        userId: ctx.session.user.id,
        details: { key: settingKey },
      });
    }

    return apiSuccess({ success: true });
  },
);
