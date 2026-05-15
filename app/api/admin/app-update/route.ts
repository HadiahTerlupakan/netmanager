import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  apiPaginated,
  createHandler,
} from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";
import {
  AppUpdateValidationError,
  appUpdateChannelSchema,
  appUpdatePlatformSchema,
  getAppUpdateService,
  parseAppUpdateUploadForm,
} from "@/modules/app-update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/admin/app-update — list updates
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

// POST /api/admin/app-update — upload bundle baru
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("app_version:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk upload Expo updates",
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Form data tidak valid",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const parsed = parseAppUpdateUploadForm(formData);
  if (!parsed.ok) {
    return apiError(parsed.failure.error, ErrorCodes.VALIDATION_ERROR, {
      status: parsed.failure.status,
    });
  }

  const service = await getAppUpdateService();
  try {
    const created = await service.uploadUpdate({
      channel: parsed.data.channel,
      runtimeVersion: parsed.data.runtimeVersion,
      platform: parsed.data.platform,
      bundleFile: parsed.data.bundleFile,
      assetFiles: parsed.data.assetFiles,
      manifest: parsed.data.manifest as unknown as Parameters<
        typeof service.uploadUpdate
      >[0]["manifest"],
      ...(parsed.data.releaseNotes
        ? { releaseNotes: parsed.data.releaseNotes }
        : {}),
      createdBy: ctx.session!.user.id,
    });

    logActivitySafe({
      action: "CREATE",
      subject: "AppUpdate",
      userId: ctx.session!.user.id,
      details: {
        id: created.id,
        manifestId: created.manifestId,
        channel: created.channel,
        runtimeVersion: created.runtimeVersion,
      },
    });

    return apiSuccess(
      { ...created, bundleSize: Number(created.bundleSize) },
      { status: 201, message: "Expo update berhasil diupload" },
    );
  } catch (error) {
    if (error instanceof AppUpdateValidationError) {
      return apiError(error.message, ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }
    throw error;
  }
});
