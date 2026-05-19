import { logger } from "@/lib/logger";
import { createHandler, apiSuccess } from "@/lib/api";
import { invalidateTimezoneCache } from "@/lib/utils/get-timezone";
import { logActivitySafe } from "@/lib/logger";
import { generalSettingsSchema } from "@/lib/validations/settings";
import {
  getGeneralSettings,
  updateGeneralSettings,
  type GeneralSettingsPayload,
} from "@/modules/settings";

/**
 * GET /api/settings/general
 * Mengambil pengaturan umum
 */
export const GET = createHandler(
  { auth: true, permissions: ["umum:read"] },
  async () => {
    return apiSuccess(await getGeneralSettings());
  },
);

/**
 * POST /api/settings/general
 * Menyimpan pengaturan umum
 */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["umum:update"],
    schema: generalSettingsSchema,
  },
  async (_req, ctx) => {
    const body: GeneralSettingsPayload = {
      ...ctx.validated,
      email: ctx.validated.email ?? "",
    };

    await updateGeneralSettings(body);

    // Invalidate both timezone caches (get-timezone.ts AND AttendanceTimezoneService)
    invalidateTimezoneCache();

    const { AttendanceTimezoneService } = await import("@/modules/attendance");
    const tzService = new AttendanceTimezoneService();

    try {
      await tzService.invalidateCache();
    } catch (error) {
      logger.error(
        "[settings/general] Failed to invalidate attendance timezone cache:",
        error,
      );
    }

    // System Log
    // ctx.session is guaranteed to exist because auth: true
    if (ctx.session?.user?.id) {
      logActivitySafe({
        action: "UPDATE",
        subject: "Settings",
        userId: ctx.session.user.id,
        details: { type: "General", updates: body },
      });
    }

    return apiSuccess({ success: true });
  },
);
