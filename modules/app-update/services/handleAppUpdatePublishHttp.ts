import type { IncomingMessage, ServerResponse } from "http";
import fs from "fs/promises";
import os from "os";
import path from "path";

import formidable from "formidable";

import { logger } from "@/lib/logger";

import { AppUpdateValidationError } from "../errors";
import { getAppUpdateService } from "./getAppUpdateService";
import {
  APP_UPDATE_MAX_BUNDLE_BYTES,
  appUpdateChannelSchema,
  appUpdatePlatformSchema,
  runtimeVersionSchema,
} from "../validators";
import { verifyAppUpdatePublishToken } from "./AppUpdatePublishAuthService";

/**
 * HTTP handler untuk POST /api/admin/app-update/publish — di-mount di
 * custom server.ts sebelum Next.js Route Handler. Pakai formidable untuk
 * stream multipart langsung ke temp file (bypass Next.js Request.formData
 * yang punya hidden 10MB body limit di App Router).
 */
export async function handleAppUpdatePublish(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const auth = verifyAppUpdatePublishToken(
    (req.headers.authorization as string | undefined) ?? null,
  );
  if (!auth.ok) {
    logger.warn("[AppUpdatePublish] auth rejected", { reason: auth.reason });
    return sendJson(res, 401, {
      success: false,
      error: "Token publish tidak valid",
      code: "UNAUTHORIZED",
    });
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ota-publish-"));
  const cleanup = async () => {
    await fs
      .rm(tmpDir, { recursive: true, force: true })
      .catch((): undefined => undefined);
  };

  try {
    const form = formidable({
      maxFileSize: APP_UPDATE_MAX_BUNDLE_BYTES,
      maxTotalFileSize: 1024 * 1024 * 1024,
      uploadDir: tmpDir,
      keepExtensions: true,
      multiples: true,
    });
    const [fields, files] = await form.parse(req);

    const channelResult = appUpdateChannelSchema.safeParse(
      firstValue(fields.channel),
    );
    if (!channelResult.success) {
      return sendValidation(res, "channel wajib 'staging' atau 'production'");
    }
    const platformResult = appUpdatePlatformSchema.safeParse(
      firstValue(fields.platform),
    );
    if (!platformResult.success) {
      return sendValidation(res, "platform wajib 'android' atau 'ios'");
    }
    const runtimeResult = runtimeVersionSchema.safeParse(
      firstValue(fields.runtimeVersion),
    );
    if (!runtimeResult.success) {
      return sendValidation(
        res,
        runtimeResult.error.issues[0]?.message ?? "runtimeVersion tidak valid",
      );
    }

    const manifestRaw = firstValue(fields.manifest);
    if (typeof manifestRaw !== "string") {
      return sendValidation(res, "manifest JSON wajib disertakan");
    }
    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(manifestRaw) as Record<string, unknown>;
    } catch {
      return sendValidation(res, "manifest harus JSON valid");
    }

    const bundleEntry = firstFile(files.bundle);
    if (!bundleEntry) {
      return sendValidation(res, "bundle file wajib disertakan");
    }
    const bundleFile = await formidableToFile(bundleEntry, "bundle");

    const assetEntries = (
      Array.isArray(files.assets)
        ? files.assets
        : files.assets
          ? [files.assets]
          : []
    ) as formidable.File[];
    const assetFiles = await Promise.all(
      assetEntries.map((entry) => formidableToFile(entry, "asset")),
    );

    const releaseNotesValue = firstValue(fields.releaseNotes);
    const releaseNotes =
      typeof releaseNotesValue === "string" && releaseNotesValue.trim()
        ? releaseNotesValue
        : undefined;

    const service = await getAppUpdateService();
    const created = await service.uploadUpdate({
      channel: channelResult.data,
      runtimeVersion: runtimeResult.data,
      platform: platformResult.data,
      bundleFile,
      assetFiles,
      manifest: manifest as unknown as Parameters<
        typeof service.uploadUpdate
      >[0]["manifest"],
      ...(releaseNotes ? { releaseNotes } : {}),
      createdBy: "ci:jenkins",
    });

    logger.info("[AppUpdatePublish] uploaded by CI", {
      id: created.id,
      manifestId: created.manifestId,
      channel: created.channel,
      runtimeVersion: created.runtimeVersion,
      platform: created.platform,
    });

    return sendJson(res, 201, {
      success: true,
      data: { ...created, bundleSize: Number(created.bundleSize) },
    });
  } catch (error) {
    if (error instanceof AppUpdateValidationError) {
      return sendValidation(res, error.message);
    }
    logger.error("[AppUpdatePublish] upload failed", error);
    return sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Publish gagal",
      code: "INTERNAL_ERROR",
    });
  } finally {
    await cleanup();
  }
}

function firstValue(field: string | string[] | undefined): string | undefined {
  if (Array.isArray(field)) return field[0];
  return field;
}

function firstFile(
  field: formidable.File | formidable.File[] | undefined,
): formidable.File | undefined {
  if (Array.isArray(field)) return field[0];
  return field;
}

async function formidableToFile(
  entry: formidable.File,
  fallbackName: string,
): Promise<File> {
  const buffer = await fs.readFile(entry.filepath);
  return new File([buffer], entry.originalFilename ?? fallbackName, {
    type: entry.mimetype ?? "application/octet-stream",
  });
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function sendValidation(res: ServerResponse, message: string): void {
  sendJson(res, 400, {
    success: false,
    error: message,
    code: "VALIDATION_ERROR",
  });
}
