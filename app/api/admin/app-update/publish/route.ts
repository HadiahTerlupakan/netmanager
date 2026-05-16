import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  AppUpdateValidationError,
  getAppUpdateService,
  parseAppUpdateUploadForm,
  verifyAppUpdatePublishToken,
} from "@/modules/app-update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Endpoint khusus Jenkins/CI: publish bundle Expo Updates pakai Bearer token.
 *
 * Setup:
 *   - Server: ENV `APP_UPDATE_PUBLISH_TOKEN` di k8s secret
 *   - Jenkins: store token sebagai credential, kirim header
 *     `Authorization: Bearer <token>` saat curl multipart POST
 *
 * Body sama dengan POST /api/admin/app-update (multipart form
 * channel + platform + runtimeVersion + manifest + bundle + assets[]).
 *
 * UI admin tetap pakai POST /api/admin/app-update (session-based).
 */
export async function POST(request: NextRequest) {
  const auth = verifyAppUpdatePublishToken(
    request.headers.get("authorization"),
  );
  if (!auth.ok) {
    logger.warn("[AppUpdatePublish] auth rejected", { reason: auth.reason });
    return apiError("Token publish tidak valid", ErrorCodes.UNAUTHORIZED, {
      status: 401,
    });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
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
      createdBy: "ci:jenkins",
    });

    logger.info("[AppUpdatePublish] uploaded by CI", {
      id: created.id,
      manifestId: created.manifestId,
      channel: created.channel,
      runtimeVersion: created.runtimeVersion,
      platform: created.platform,
    });

    return NextResponse.json(
      {
        success: true,
        data: { ...created, bundleSize: Number(created.bundleSize) },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AppUpdateValidationError) {
      return apiError(error.message, ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }
    logger.error("[AppUpdatePublish] upload failed", error);
    return apiError(
      error instanceof Error ? error.message : "Publish gagal",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}
