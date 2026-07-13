import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { z } from "zod";
import { getFullRadiusMode, setFullRadiusMode } from "@/modules/settings";

const toggleSchema = z.object({
  enabled: z.boolean(),
});

/** GET /api/admin/settings/full-radius-mode → { enabled: boolean } */
export const GET = createHandler({ auth: true }, async () => {
  const enabled = await getFullRadiusMode();
  return apiSuccess({ enabled });
});

/**
 * POST /api/admin/settings/full-radius-mode
 * Body: { enabled: boolean }
 *
 * Why: toggle global yang menentukan apakah modul accel-ppp aktif.
 * Disimpan sebagai key `FULL_RADIUS_MODE` di tabel `Settings` (tenantId null).
 */
export const POST = createHandler(
  { auth: true, schema: toggleSchema },
  async (_req, ctx) => {
    if (!(await hasPermission("umum:update"))) {
      return ApiErrors.forbidden("Akses ditolak");
    }
    await setFullRadiusMode(ctx.validated.enabled);
    return apiSuccess({ enabled: ctx.validated.enabled });
  },
);
