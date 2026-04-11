import { createHandler, apiSuccess } from "@/lib/api";
import { clearR2SettingsCache } from "@/lib/utils/r2-client";
import { logActivitySafe } from "@/lib/logger";
import { apiSettingsSchema } from "@/lib/validations/settings";
import {
  getApiSettings,
  updateApiSettings,
  type ApiSettingsPostPayload,
} from "@/modules/settings";

/**
 * GET /api/settings/api
 * Mengambil pengaturan API
 */
export const GET = createHandler(
  { auth: true, permissions: ["api:read", "settings:read"] },
  async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const settings = await getApiSettings(tenantId);
    return apiSuccess(settings);
  },
);

/**
 * POST /api/settings/api
 * Menyimpan pengaturan API
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["settings:update"],
    schema: apiSettingsSchema,
  },
  async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const body: ApiSettingsPostPayload = ctx.validated;
    await updateApiSettings(tenantId, body);

    clearR2SettingsCache();

    // System Log
    // ctx.session is guaranteed to exist because auth: true
    if (ctx.session?.user?.id) {
      logActivitySafe({
        action: "UPDATE",
        subject: "Settings",
        userId: ctx.session.user.id,
        details: { type: "API/R2 Configuration" },
      });
    }

    return apiSuccess({ success: true });
  },
);
