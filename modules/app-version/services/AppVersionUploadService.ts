import fs from "fs/promises";

import { logger } from "@/lib/logger";
import type {
  AppVersion,
  CreateAppVersionDTO,
} from "../domain/entities/AppVersionEntity";
import type { IAppVersionRepository } from "../domain/ports/IAppVersionRepository";
import { clearVersionCache } from "../repositories/AppVersionRepository";
import {
  deleteUploadedApkObject,
  loadUploadedApkDetails,
  persistApkFileToTemp,
  uploadApkFile,
  cleanupStoredApk,
} from "./app-version-storage.helpers";
import { parseApkInfo } from "./app-version-parse.helpers";
import type { UploadVersionInput } from "./AppVersionService.types";

interface ResolvedUploadInput {
  input: UploadVersionInput;
  cleanupPaths: Set<string>;
  resolvedApkPath?: string;
  resolvedApkFilename?: string;
  resolvedApkSize?: number;
}

interface AppVersionMetadata {
  version: string;
  buildNumber: number;
  versionCode: number;
}

interface UploadApkResolution {
  url?: string;
  uploadedByService: boolean;
}

export class AppVersionUploadService {
  constructor(
    private readonly repository: IAppVersionRepository,
    private readonly parseApkInfoFn = parseApkInfo,
  ) {}

  /** Upload versi aplikasi baru beserta APK dan metadata hasil parsing. */
  async uploadVersion(input: UploadVersionInput): Promise<AppVersion> {
    const uploadInput = await this.resolveUploadInput(input);
    let apkResolution: UploadApkResolution = { uploadedByService: false };

    try {
      const createdVersion = await this.createUploadedVersion(
        uploadInput,
        input,
      );
      apkResolution = createdVersion.apkResolution;
      return createdVersion.version;
    } catch (error) {
      await this.handleUploadFailure(input, apkResolution, error);
    } finally {
      await this.cleanupTempFiles(uploadInput.cleanupPaths);
    }
  }

  private async createUploadedVersion(
    uploadInput: ResolvedUploadInput,
    input: UploadVersionInput,
  ) {
    const uploadedApk = await loadUploadedApkDetails(input);
    const metadata = await this.resolveMetadata(
      uploadInput,
      uploadedApk.apkBuffer,
    );
    await this.assertVersionIsUnique(metadata);
    const apkResolution = await this.resolveApkUrl(
      uploadInput,
      metadata,
      uploadedApk.apkUrl,
    );
    const apkSize = this.resolveApkSize(
      input,
      uploadedApk.apkSize,
      uploadInput.resolvedApkSize,
    );
    const createData = this.buildCreateData(
      input,
      metadata,
      apkResolution.url,
      apkSize,
    );
    const version = await this.repository.create(createData);
    clearVersionCache();
    return { version, apkResolution };
  }

  private async handleUploadFailure(
    input: UploadVersionInput,
    apkResolution: UploadApkResolution,
    error: unknown,
  ): Promise<never> {
    await this.cleanupFailedUpload(input, apkResolution);
    logger.error("[AppVersionService] Error in uploadVersion:", error);
    const err = error as { message?: string };
    throw new Error(
      `Gagal mengunggah versi aplikasi: ${err?.message || "Terjadi kesalahan"}`,
    );
  }

  private async resolveUploadInput(
    input: UploadVersionInput,
  ): Promise<ResolvedUploadInput> {
    const cleanupPaths = new Set<string>();
    let resolvedApkPath = input.apkPath;
    let resolvedApkFilename = input.apkFilename;
    let resolvedApkSize = input.apkSize;

    if (input.apkFile) {
      const persisted = await persistApkFileToTemp(input.apkFile);
      resolvedApkPath = persisted.path;
      resolvedApkFilename = resolvedApkFilename || persisted.filename;
      resolvedApkSize = resolvedApkSize ?? persisted.size;
      cleanupPaths.add(persisted.path);
    }

    if (input.cleanupApkPath && resolvedApkPath)
      cleanupPaths.add(resolvedApkPath);
    return {
      input,
      cleanupPaths,
      resolvedApkPath,
      resolvedApkFilename,
      resolvedApkSize,
    };
  }

  private async resolveMetadata(
    uploadInput: ResolvedUploadInput,
    uploadedApkBuffer?: Buffer,
  ): Promise<AppVersionMetadata> {
    let version = uploadInput.input.version;
    let buildNumber = uploadInput.input.buildNumber;
    let versionCode = uploadInput.input.versionCode;

    if (this.hasApkSource(uploadInput, uploadedApkBuffer)) {
      const apkInfo = await this.parseApkInfoFn({
        ...(uploadedApkBuffer ? { buffer: uploadedApkBuffer } : {}),
        ...(uploadInput.input.apkBuffer
          ? { buffer: uploadInput.input.apkBuffer }
          : {}),
        ...(uploadInput.resolvedApkPath
          ? { path: uploadInput.resolvedApkPath }
          : {}),
      });
      if (!apkInfo) throw new Error("Gagal membaca metadata APK yang diupload");
      this.assertMetadataMatchesInput(
        { version, buildNumber, versionCode },
        apkInfo,
      );
      version = version || apkInfo.versionName;
      buildNumber = buildNumber || apkInfo.buildNumber;
      versionCode = versionCode || apkInfo.versionCode;
    }

    if (!version || !buildNumber || !versionCode) {
      throw new Error(
        "Version, buildNumber, dan versionCode wajib diisi atau upload APK untuk auto-detect",
      );
    }
    return { version, buildNumber, versionCode };
  }

  private hasApkSource(input: ResolvedUploadInput, uploadedApkBuffer?: Buffer) {
    return Boolean(
      input.input.apkBuffer || input.resolvedApkPath || uploadedApkBuffer,
    );
  }

  private assertMetadataMatchesInput(
    input: Partial<AppVersionMetadata>,
    apkInfo: { versionName: string; buildNumber: number; versionCode: number },
  ) {
    if (
      (input.version && input.version !== apkInfo.versionName) ||
      (input.buildNumber && input.buildNumber !== apkInfo.buildNumber) ||
      (input.versionCode && input.versionCode !== apkInfo.versionCode)
    ) {
      throw new Error("Metadata versi tidak cocok dengan APK yang diupload");
    }
  }

  private async assertVersionIsUnique(metadata: AppVersionMetadata) {
    const exists = await this.repository.exists(
      metadata.version,
      metadata.versionCode,
    );
    if (exists.versionExists)
      throw new Error(`Version ${metadata.version} sudah ada`);
    if (exists.versionCodeExists) {
      throw new Error(`Version code ${metadata.versionCode} sudah ada`);
    }
  }

  private async resolveApkUrl(
    input: ResolvedUploadInput,
    metadata: AppVersionMetadata,
    uploadedApkUrl?: string,
  ) {
    if (
      input.input.uploadedKey ||
      (!input.input.apkBuffer && !input.resolvedApkPath)
    ) {
      return { url: uploadedApkUrl, uploadedByService: false };
    }
    const filename =
      input.resolvedApkFilename ?? `netmanager_v${metadata.version}.apk`;
    const url = await uploadApkFile({
      ...(input.input.apkBuffer ? { buffer: input.input.apkBuffer } : {}),
      ...(input.resolvedApkPath ? { path: input.resolvedApkPath } : {}),
      filename,
      version: metadata.version,
      forceLocal: input.input.forceLocal,
    });
    return { url, uploadedByService: true };
  }

  private resolveApkSize(
    input: UploadVersionInput,
    uploadedSize?: number,
    resolvedSize?: number,
  ) {
    return uploadedSize ?? resolvedSize ?? input.apkSize;
  }

  private buildCreateData(
    input: UploadVersionInput,
    metadata: AppVersionMetadata,
    apkUrl?: string,
    apkSize?: number,
  ): CreateAppVersionDTO {
    return {
      version: metadata.version,
      buildNumber: metadata.buildNumber,
      versionCode: metadata.versionCode,
      platform: input.platform || "android",
      ...(apkUrl ? { apkUrl } : {}),
      ...(apkSize ? { apkSize: BigInt(apkSize) } : {}),
      ...(input.releaseNotes ? { releaseNotes: input.releaseNotes } : {}),
      isForceUpdate: input.isForceUpdate || false,
      ...(input.minVersion ? { minVersion: input.minVersion } : {}),
      isActive: true,
      publishedAt: new Date(),
      ...(input.createdBy ? { createdBy: input.createdBy } : {}),
    };
  }

  private async cleanupFailedUpload(
    input: UploadVersionInput,
    apkResolution: UploadApkResolution,
  ) {
    if (input.uploadedKey) await this.cleanupUploadedObject(input.uploadedKey);
    if (apkResolution.uploadedByService && apkResolution.url) {
      await this.cleanupStoredApk(apkResolution.url);
    }
  }

  private async cleanupUploadedObject(uploadedKey: string) {
    try {
      await deleteUploadedApkObject(uploadedKey);
    } catch (error) {
      logger.warn(
        "Gagal membersihkan APK direct upload setelah create versi gagal:",
        error,
      );
    }
  }

  private async cleanupStoredApk(apkUrl: string) {
    try {
      await cleanupStoredApk(apkUrl);
    } catch (error) {
      logger.warn("Gagal membersihkan APK setelah create versi gagal:", error);
    }
  }

  private async cleanupTempFiles(cleanupPaths: Set<string>) {
    for (const cleanupPath of cleanupPaths) {
      try {
        await fs.unlink(cleanupPath);
      } catch (error) {
        logger.warn(
          `[AppVersionService] Failed to cleanup temp APK: ${cleanupPath}`,
          error,
        );
      }
    }
  }
}
