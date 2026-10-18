import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { logActivitySafe, logger } from "@/lib/logger";
import { PlayStoreReleaseService } from "@/modules/app-version";
import { denyUnlessMainTenant } from "./guard";

export const dynamic = "force-dynamic";

// GET /api/admin/app-update/min-version — rilis Play Store dan versi minimum
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = await denyUnlessMainTenant(
    ctx.session!.user.tenantId,
    "app_version:read",
  );
  if (denied) return denied;
  return apiSuccess(await new PlayStoreReleaseService().overview());
});

// POST /api/admin/app-update/min-version — sinkronkan dari Google Play sekarang
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  const denied = await denyUnlessMainTenant(
    ctx.session!.user.tenantId,
    "app_version:update",
  );
  if (denied) return denied;
  try {
    const result = await new PlayStoreReleaseService().sync();
    logActivitySafe({
      action: "UPDATE",
      subject: "PlayStoreRelease",
      userId: ctx.session!.user.id,
      details: { sync: result },
    });
    return apiSuccess(result);
  } catch (error) {
    logger.error("[PlayStoreSync] Sinkronisasi manual gagal:", error);
    return ApiErrors.internalError("Gagal membaca Google Play");
  }
});
