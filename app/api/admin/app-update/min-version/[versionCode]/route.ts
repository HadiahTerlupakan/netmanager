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

// PATCH /api/admin/app-update/min-version/[versionCode]
// Body `{ cancelled: boolean }` membatalkan/memulihkan penguncian;
// `{ enforceNow: true }` mewajibkan rilis sekarang tanpa menunggu tenggang.
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const denied = await denyUnlessMainTenant(
    ctx.session!.user.tenantId,
    "app_version:update",
  );
  if (denied) return denied;

  const versionCode = Number(ctx.params.versionCode);
  const body = (await req.json().catch((): unknown => null)) as {
    cancelled?: unknown;
    enforceNow?: unknown;
  } | null;
  const enforceNow = body?.enforceNow === true;
  if (
    !Number.isInteger(versionCode) ||
    (!enforceNow && typeof body?.cancelled !== "boolean")
  ) {
    return apiError(
      "versionCode dan cancelled (boolean) atau enforceNow wajib",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const service = new PlayStoreReleaseService();
  const userId = ctx.session!.user.id;
  const updated = enforceNow
    ? await service.enforceNow(versionCode, userId)
    : await service.setCancelled(
        versionCode,
        body!.cancelled as boolean,
        userId,
      );
  if (!updated) return ApiErrors.notFound("Rilis Play Store aktif");

  const change = enforceNow
    ? { enforceNow: true }
    : { cancelled: body!.cancelled };
  logActivitySafe({
    action: "UPDATE",
    subject: "PlayStoreRelease",
    userId,
    details: { versionCode, ...change },
  });
  return apiSuccess({ versionCode, ...change });
});
