import { z } from "zod";
import { hasPermission } from "@/lib/rbac";
import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import {
  getAppUpdateContact,
  updateAppUpdateContact,
} from "@/modules/settings";

export const dynamic = "force-dynamic";

const contactSettingsSchema = z.object({
  appUpdateContactUrl: z.string().min(1).nullable().optional(),
  appUpdateContactLabel: z.string().max(50).nullable().optional(),
});

/**
 * GET /api/admin/app-update/contact-settings
 * Mengambil pengaturan kontak admin untuk update APK.
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("app_version:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat pengaturan update aplikasi",
    );
  }

  const tenantId = ctx.session!.user.tenantId;
  const contact = await getAppUpdateContact(tenantId);
  return apiSuccess(contact);
});

/**
 * PUT /api/admin/app-update/contact-settings
 * Menyimpan pengaturan kontak admin untuk update APK.
 */
export const PUT = createHandler(
  { auth: true, schema: contactSettingsSchema },
  async (_req, ctx) => {
    if (!(await hasPermission("app_version:update"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah pengaturan update aplikasi",
      );
    }

    const tenantId = ctx.session!.user.tenantId;
    const { appUpdateContactUrl, appUpdateContactLabel } = ctx.validated;

    await updateAppUpdateContact(tenantId, {
      appUpdateContactUrl: appUpdateContactUrl ?? null,
      appUpdateContactLabel: appUpdateContactLabel ?? null,
    });

    return apiSuccess(null, { message: "Pengaturan kontak berhasil disimpan" });
  },
);
