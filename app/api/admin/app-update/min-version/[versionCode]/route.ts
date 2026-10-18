import {
  apiError,
  apiSuccess,
  ApiErrors,
  createHandler,
  ErrorCodes,
} from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";
import { PlayStoreReleaseService } from "@/modules/app-version";
import { denyUnlessMainTenant } from "../guard";

export const dynamic = "force-dynamic";

// PATCH /api/admin/app-update/min-version/[versionCode] — batalkan/pulihkan penguncian
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const denied = await denyUnlessMainTenant(
    ctx.session!.user.tenantId,
    "app_version:update",
  );
  if (denied) return denied;

  const versionCode = Number(ctx.params.versionCode);
  const body = (await req.json().catch((): unknown => null)) as {
    cancelled?: unknown;
  } | null;
  if (!Number.isInteger(versionCode) || typeof body?.cancelled !== "boolean") {
    return apiError(
      "versionCode dan cancelled (boolean) wajib",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const updated = await new PlayStoreReleaseService().setCancelled(
    versionCode,
    body.cancelled,
    ctx.session!.user.id,
  );
  if (!updated) return ApiErrors.notFound("Rilis Play Store");

  logActivitySafe({
    action: "UPDATE",
    subject: "PlayStoreRelease",
    userId: ctx.session!.user.id,
    details: { versionCode, cancelled: body.cancelled },
  });
  return apiSuccess({ versionCode, cancelled: body.cancelled });
});
