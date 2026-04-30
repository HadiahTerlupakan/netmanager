import fs from "fs/promises";
import os from "os";
import path from "path";

import { logger } from "@/lib/logger";

interface ApkManifest {
  versionCode: number;
  versionName: string;
  package: string;
}

export interface ParsedApkInfo {
  versionName: string;
  versionCode: number;
  packageName: string;
  buildNumber: number;
}

const TEMP_APK_PREFIX = "apk_";
const APK_EXTENSION = ".apk";
const VERSION_PART_INDEX = 2;

/** Parse metadata APK dari temp path atau buffer. */
export async function parseApkInfo(input: {
  buffer?: Buffer;
  path?: string;
}): Promise<ParsedApkInfo | null> {
  const tempFilePath = await resolveApkTempPath(input);
  if (!tempFilePath) {
    logger.warn("[AppVersionService] No APK buffer or path provided");
    return null;
  }

  try {
    const manifest = await readApkManifest(tempFilePath);
    return buildParsedApkInfo(manifest);
  } catch (error: unknown) {
    logApkParseError(error);
    return null;
  } finally {
    await cleanupTempApkFile(tempFilePath, input.path);
  }
}

async function readApkManifest(tempFilePath: string): Promise<ApkManifest> {
  const apkReaderModule = await import("adbkit-apkreader");
  const ApkReader = apkReaderModule.default || apkReaderModule;
  const reader = await ApkReader.open(tempFilePath);
  return (await reader.readManifest()) as ApkManifest;
}

async function resolveApkTempPath(input: { buffer?: Buffer; path?: string }) {
  if (input.path) {
    return input.path;
  }

  if (!input.buffer) {
    return null;
  }

  const tempPath = path.join(
    os.tmpdir(),
    `${TEMP_APK_PREFIX}${Date.now()}${APK_EXTENSION}`,
  );
  await fs.writeFile(tempPath, input.buffer);
  return tempPath;
}

function buildParsedApkInfo(manifest: ApkManifest): ParsedApkInfo {
  const versionName = manifest.versionName || "";
  const versionCode = manifest.versionCode || 0;
  const buildNumber = resolveBuildNumber(versionName, versionCode);

  return {
    versionName,
    versionCode,
    packageName: manifest.package || "",
    buildNumber,
  };
}

function resolveBuildNumber(versionName: string, versionCode: number): number {
  const versionParts = versionName.split(".");
  const patchPart = versionParts[VERSION_PART_INDEX] ?? "0";
  return versionParts.length >= 3
    ? parseInt(patchPart, 10) || versionCode
    : versionCode;
}

function logApkParseError(error: unknown): void {
  logger.error("[AppVersionService] Error parsing APK:", error);
  const err = error as { message?: string; stack?: string; code?: string };
  logger.error("[AppVersionService] Error details:", {
    message: err?.message,
    stack: err?.stack,
    code: err?.code,
  });
}

async function cleanupTempApkFile(
  tempFilePath: string | null,
  inputPath?: string,
): Promise<void> {
  if (!tempFilePath || inputPath) {
    return;
  }

  try {
    await fs.unlink(tempFilePath);
  } catch (error: unknown) {
    const err = error as { message?: string };
    logger.warn(
      `[AppVersionService] Failed to cleanup temp file: ${err?.message}`,
    );
  }
}
