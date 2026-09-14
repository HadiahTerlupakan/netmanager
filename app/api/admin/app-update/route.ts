import { hasPermission } from "@/lib/rbac";
import {
  ApiErrors,
  ErrorCodes,
  apiError,
  apiPaginated,
  createHandler,
} from "@/lib/api";
import {
  appUpdateChannelSchema,
  appUpdatePlatformSchema,
  getAppUpdateService,
} from "@/modules/app-update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/app-update — list updates
//
// Catatan: endpoint POST /api/admin/app-update untuk upload manual via UI
// sengaja DIHAPUS — semua publish wajib lewat pipeline CI (endpoint
// POST /api/admin/app-update/publish dengan Bearer token). Ini menjaga
// audit trail tetap rapi: semua bundle Expo tercatat sebagai CI build.
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
  if (!(await hasPermission("app_version:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat Expo updates",
    );
  }

  const { searchParams } = req.nextUrl;
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const channelParam = searchParams.get("channel");
  const platformParam = searchParams.get("platform");

  const channel = channelParam
    ? appUpdateChannelSchema.safeParse(channelParam)
    : null;
  const platform = platformParam
    ? appUpdatePlatformSchema.safeParse(platformParam)
    : null;
  if (channel && !channel.success) {
    return apiError("channel tidak valid", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }
  if (platform && !platform.success) {
    return apiError("platform tidak valid", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  const service = await getAppUpdateService();
  const result = await service.listUpdates({
    page,
    limit,
    ...(channel?.data ? { channel: channel.data } : {}),
    ...(platform?.data ? { platform: platform.data } : {}),
  });

  return apiPaginated(result.data, { page, limit, total: result.total });
});
