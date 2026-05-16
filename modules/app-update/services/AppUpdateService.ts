import { randomUUID } from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { logger } from "@/lib/logger";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";

import type {
  AppUpdate,
  AppUpdateChannel,
  AppUpdatePlatform,
  AppUpdateAsset,
} from "../domain/entities/AppUpdateEntity";
import type { IAppUpdateRepository } from "../domain/ports/IAppUpdateRepository";
import { AppUpdateNotFoundError, AppUpdateValidationError } from "../errors";
import { AppUpdateRepository } from "../repositories/AppUpdateRepository";
import { buildManifestBody } from "./app-update-manifest.helpers";
import {
  computeFileSha256,
  deleteUpdateDir,
  getUpdateDir,
  persistFile,
  resolveAssetPath,
  resolveBundlePath,
} from "./app-update-storage.helpers";
import { signManifestBody } from "./AppUpdateSigningService";

const BUNDLE_FILE_PATTERN = /\.(bundle|hbc|js)$/i;

interface ManifestPayload {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: {
    hash: string;
    contentType: string;
    fileExtension?: string;
  };
  assets?: Array<{
    hash: string;
    contentType: string;
    fileExtension?: string;
  }>;
  metadata?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

interface UploadInput {
  channel: AppUpdateChannel;
  runtimeVersion: string;
  platform: AppUpdatePlatform;
  bundleFile: File;
  assetFiles: File[];
  manifest: ManifestPayload;
  releaseNotes?: string;
  tenantId?: string;
  createdBy?: string;
}

interface BuiltManifest {
  body: string;
  signature: string | null;
  signatureKeyId: string | null;
  contentType: "application/json";
}

export class AppUpdateService {
  constructor(
    private readonly repository: IAppUpdateRepository = new AppUpdateRepository(),
  ) {}

  /** Cari manifest aktif untuk channel + runtime + platform tertentu. */
  async findLatestActive(query: {
    channel: AppUpdateChannel;
    runtimeVersion: string;
    platform: AppUpdatePlatform;
  }): Promise<AppUpdate | null> {
    return this.repository.findLatestActive(query);
  }

  /** Build manifest body siap kirim, lengkap dengan signature header. */
  buildManifestForResponse(params: {
    baseUrl: string;
    update: AppUpdate;
  }): BuiltManifest {
    const body = buildManifestBody(params);
    const signed = signManifestBody(body);
    return {
      body,
      signature: signed?.signature ?? null,
      signatureKeyId: signed?.keyId ?? null,
      contentType: "application/json",
    };
  }

  /**
   * Upload bundle Expo Updates baru.
   * Server simpan bundle + assets ke PVC di structure terisolasi per id,
   * verify hash sesuai manifest yang dikirim FE, lalu insert record DB.
   */
  async uploadUpdate(input: UploadInput): Promise<AppUpdate> {
    const updateId = randomUUID();
    const stagingDir = path.join(os.tmpdir(), `app_update_${updateId}`);
    await fs.mkdir(stagingDir, { recursive: true });

    try {
      const bundleResult = await this.persistBundle({
        updateId,
        bundleFile: input.bundleFile,
        stagingDir,
      });
      const assets = await this.persistAssets({
        updateId,
        assetFiles: input.assetFiles,
        manifest: input.manifest,
        stagingDir,
      });
      this.assertManifestMatchesUploads({
        manifest: input.manifest,
        bundleHash: bundleResult.hash,
        assets,
      });

      const created = await this.repository.create({
        manifestId: input.manifest.id,
        channel: input.channel,
        runtimeVersion: input.runtimeVersion,
        platform: input.platform,
        bundleHash: bundleResult.hash,
        bundlePath: bundleResult.relativePath,
        bundleSize: BigInt(bundleResult.size),
        assets,
        ...(input.manifest.metadata
          ? { metadata: input.manifest.metadata }
          : {}),
        ...(input.releaseNotes ? { releaseNotes: input.releaseNotes } : {}),
        commitTime: parseManifestCreatedAt(input.manifest.createdAt),
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        ...(input.createdBy ? { createdBy: input.createdBy } : {}),
      });

      logger.info("[AppUpdateService] uploaded", {
        id: created.id,
        manifestId: created.manifestId,
        channel: created.channel,
        runtimeVersion: created.runtimeVersion,
        bundleSize: bundleResult.size,
      });

      return this.relocateToFinalDir(created.id, updateId)
        .then(() => created)
        .catch(async (relocateError) => {
          logger.error(
            "[AppUpdateService] Failed to relocate update dir, rolling back",
            relocateError,
          );
          await this.repository.delete(created.id).catch((): void => undefined);
          throw relocateError;
        });
    } catch (error) {
      await deleteUpdateDir(updateId).catch((): void => undefined);
      if (error instanceof AppUpdateValidationError) throw error;
      logger.error("[AppUpdateService] uploadUpdate failed", error);
      throw new Error(
        `Gagal mengunggah Expo update: ${
          error instanceof Error ? error.message : "Terjadi kesalahan"
        }`,
      );
    } finally {
      await fs
        .rm(stagingDir, { recursive: true, force: true })
        .catch((): void => undefined);
    }
  }

  /** Daftar update untuk admin panel. */
  async listUpdates(options?: {
    channel?: AppUpdateChannel;
    platform?: AppUpdatePlatform;
    page?: number;
    limit?: number;
  }) {
    return this.repository.findAll(options);
  }

  async getById(id: string): Promise<AppUpdate | null> {
    return this.repository.findById(id);
  }

  async setActive(id: string, isActive: boolean): Promise<AppUpdate> {
    try {
      return await this.repository.setActive(id, isActive);
    } catch (error) {
      if (isPrismaRecordNotFoundError(error)) {
        throw new AppUpdateNotFoundError();
      }
      throw error;
    }
  }

  async deleteUpdate(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppUpdateNotFoundError();
    }
    await this.repository.delete(id);
    await deleteUpdateDir(id).catch((err) =>
      logger.warn("[AppUpdateService] Failed to delete update dir", err),
    );
  }

  /** Resolve absolute path file asset untuk endpoint download. */
  async resolveAssetFile(query: {
    updateId: string;
    hash: string;
    type: "bundle" | "asset";
  }): Promise<{
    filePath: string;
    contentType: string;
    fileSize: number;
  } | null> {
    const update = await this.repository.findById(query.updateId);
    if (!update) return null;

    if (query.type === "bundle") {
      if (update.bundleHash !== query.hash) return null;
      const filePath = resolveBundlePath(update.id, update.bundleHash);
      const fileSize = Number(update.bundleSize);
      return {
        filePath,
        contentType: "application/javascript",
        fileSize,
      };
    }

    const asset = update.assets.find((entry) => entry.hash === query.hash);
    if (!asset) return null;
    const filePath = resolveAssetPath(update.id, asset.hash);
    return {
      filePath,
      contentType: asset.contentType,
      fileSize: asset.size,
    };
  }

  private async persistBundle(input: {
    updateId: string;
    bundleFile: File;
    stagingDir: string;
  }) {
    if (!input.bundleFile?.size) {
      throw new AppUpdateValidationError("Bundle file wajib disertakan");
    }
    const ext = path.extname(input.bundleFile.name).toLowerCase();
    if (!BUNDLE_FILE_PATTERN.test(input.bundleFile.name)) {
      throw new AppUpdateValidationError(
        `Bundle harus berformat .bundle/.hbc/.js (got ${ext})`,
      );
    }
    const tempPath = path.join(input.stagingDir, "bundle.tmp");
    const arrayBuffer = await input.bundleFile.arrayBuffer();
    await fs.writeFile(tempPath, Buffer.from(arrayBuffer));

    const hash = await computeFileSha256(tempPath);
    const destinationPath = resolveBundlePath(input.updateId, hash);
    await persistFile(tempPath, destinationPath);

    return {
      hash,
      size: input.bundleFile.size,
      relativePath: path.relative(
        getUpdateDir(input.updateId),
        destinationPath,
      ),
    };
  }

  private async persistAssets(input: {
    updateId: string;
    assetFiles: File[];
    manifest: ManifestPayload;
    stagingDir: string;
  }): Promise<AppUpdateAsset[]> {
    if (input.assetFiles.length === 0) {
      return [];
    }
    const manifestAssets = input.manifest.assets ?? [];
    if (manifestAssets.length !== input.assetFiles.length) {
      throw new AppUpdateValidationError(
        `Jumlah asset di manifest (${manifestAssets.length}) tidak cocok dengan file yang diupload (${input.assetFiles.length})`,
      );
    }

    // Hitung hash semua uploaded asset dulu, lalu match by hash (bukan positional).
    // Curl multipart kadang tidak preserve order field saat ada duplicate path,
    // jadi kita rely on content-addressable matching via SHA-256.
    const uploadedFiles: { tempPath: string; hash: string; size: number }[] =
      [];
    for (let i = 0; i < input.assetFiles.length; i++) {
      const file = input.assetFiles[i]!;
      const tempPath = path.join(input.stagingDir, `asset_${i}.tmp`);
      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(tempPath, Buffer.from(arrayBuffer));
      const stat = await fs.stat(tempPath);
      const hash = await computeFileSha256(tempPath);
      uploadedFiles.push({ tempPath, hash, size: stat.size });
    }
    const uploadedByHash = new Map<string, (typeof uploadedFiles)[number]>();
    for (const entry of uploadedFiles) {
      uploadedByHash.set(entry.hash, entry);
    }

    const persisted: AppUpdateAsset[] = [];
    for (const expected of manifestAssets) {
      const uploaded = uploadedByHash.get(expected.hash);
      if (!uploaded) {
        throw new AppUpdateValidationError(
          `Asset dengan hash ${expected.hash} (${expected.fileExtension ?? "?"}) tidak ditemukan di file yang diupload`,
        );
      }
      const ext = (expected.fileExtension || "")
        .replace(/^\./, "")
        .toLowerCase();
      const destinationPath = resolveAssetPath(input.updateId, expected.hash);
      await persistFile(uploaded.tempPath, destinationPath);
      persisted.push({
        hash: expected.hash,
        ext,
        contentType: expected.contentType,
        path: path.posix.join("assets", expected.hash),
        size: uploaded.size,
      });
    }
    return persisted;
  }

  private assertManifestMatchesUploads(input: {
    manifest: ManifestPayload;
    bundleHash: string;
    assets: AppUpdateAsset[];
  }) {
    if (input.manifest.launchAsset?.hash !== input.bundleHash) {
      throw new AppUpdateValidationError(
        `Bundle hash tidak cocok dengan manifest (${input.manifest.launchAsset?.hash} vs ${input.bundleHash})`,
      );
    }
  }

  private async relocateToFinalDir(
    finalId: string,
    stagingId: string,
  ): Promise<void> {
    if (finalId === stagingId) return;
    const stagingDir = getUpdateDir(stagingId);
    const finalDir = getUpdateDir(finalId);
    await fs.mkdir(path.dirname(finalDir), { recursive: true });
    await fs.rename(stagingDir, finalDir);
  }
}

function parseManifestCreatedAt(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppUpdateValidationError(
      "manifest.createdAt harus ISO date string yang valid",
    );
  }
  return date;
}
