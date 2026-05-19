import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { clearR2SettingsCache } from "@/lib/utils/r2-client";
import { logActivitySafe } from "@/lib/logger";
import { apiSettingsSchema } from "@/lib/validations/settings";
import {
  getApiSettings,
  createApiSettings,
  updateApiSettings,
  type ApiSettingsPostPayload,
} from "@/modules/settings";

/**
 * GET /api/settings/api
 * Mengambil pengaturan API
 */
export const GET = createHandler(
  { auth: true, permissions: ["api:read"] },
  async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const settings = await getApiSettings(tenantId);
    return apiSuccess(settings);
  },
);

/**
 * POST /api/settings/api
 * Membuat pengaturan API baru (create)
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["api:create"],
    schema: apiSettingsSchema,
  },
  async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const body: ApiSettingsPostPayload = ctx.validated;

    try {
      await createApiSettings(tenantId, body);
      clearR2SettingsCache();

      // System Log
      if (ctx.session?.user?.id) {
        logActivitySafe({
          action: "CREATE",
          subject: "Settings",
          userId: ctx.session.user.id,
          details: { type: "API/R2 Configuration" },
        });
      }

      return apiSuccess({
        success: true,
        message: "Pengaturan API berhasil dibuat",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return ApiErrors.conflict(
          "Pengaturan sudah ada, gunakan PUT untuk update",
        );
      }
      throw error;
    }
  },
);

/**
 * PUT /api/settings/api
 * Mengupdate pengaturan API yang sudah ada (edit)
 */
export const PUT = createHandler(
  {
    auth: true,
    permissions: ["api:update"],
    schema: apiSettingsSchema,
  },
  async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const body: ApiSettingsPostPayload = ctx.validated;

    try {
      await updateApiSettings(tenantId, body);
      clearR2SettingsCache();

      // System Log
      if (ctx.session?.user?.id) {
        logActivitySafe({
          action: "UPDATE",
          subject: "Settings",
          userId: ctx.session.user.id,
          details: { type: "API/R2 Configuration" },
        });
      }

      return apiSuccess({
        success: true,
        message: "Pengaturan API berhasil diupdate",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return ApiErrors.notFound(
          "Pengaturan tidak ditemukan, gunakan POST untuk create",
        );
      }
      throw error;
    }
  },
);
