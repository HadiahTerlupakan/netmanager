import { logger } from "@/lib/logger";
import type {
  AppVersion,
  CreateAppVersionDTO,
  UpdateAppVersionDTO,
  AppVersionWithUser,
  AppVersionRolloutStats,
} from "../domain/entities/AppVersionEntity";
import type { IAppVersionRepository } from "../domain/ports/IAppVersionRepository";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import { prisma, prismaMitra } from "@/modules/database";
import fs from "fs/promises";

import {
  cleanupStoredApk,
  createDirectUploadUrl as createDirectUploadApkUrl,
  deleteUploadedApkObject,
  loadUploadedApkDetails,
  parseApkInfo as parseUploadedApkInfo,
  persistApkFileToTemp,
  type ParsedApkInfo,
  uploadApkFile,
} from "./app-version-upload-helpers";

export interface UploadVersionInput {
  version?: string; // Optional jika auto-extract dari APK
  buildNumber?: number; // Optional jika auto-extract dari APK
  versionCode?: number; // Optional jika auto-extract dari APK
  platform?: string;
  releaseNotes?: string;
  isForceUpdate?: boolean;
  minVersion?: string;
  apkBuffer?: Buffer;
  apkPath?: string;
  apkFilename?: string;
  apkSize?: number;
  apkFile?: File;
  cleanupApkPath?: boolean;
  createdBy?: string;
  // New fields for pre-uploaded files
  uploadedKey?: string;
  uploadedFilename?: string;
  uploadedSize?: number;
  forceLocal?: boolean;
}

export interface CheckVersionResult {
  updateAvailable: boolean;
  isForceUpdate: boolean;
  currentVersion: string;
  latestVersion: {
    id: string;
    version: string;
    buildNumber: number;
    versionCode: number;
    releaseNotes: string | null;
    downloadUrl: string | null;
    apkSize: number | null;
  } | null;
}

export interface VersionAccessResult extends CheckVersionResult {
  isSupported: boolean;
  currentVersionCode: number;
  minimumVersion: string | null;
}

export interface AppVersionStatsResult extends AppVersionRolloutStats {
  latestVersion: {
    version: string;
    versionCode: number;
  } | null;
}

export interface MobileVersionReportInput {
  sessionUserId: string;
  tenantId?: string | null;
  role?: string | null;
  versionCode: unknown;
  versionName?: string | null;
}

export { getAppVersionService } from "../factories/app-version-service-factory";

export class AppVersionService {
  constructor(private readonly repository: IAppVersionRepository) {}

  /** Parse APK metadata from a file path or buffer. */
  async parseApkInfo(input: {
    buffer?: Buffer;
    path?: string;
  }): Promise<ParsedApkInfo | null> {
    return parseUploadedApkInfo(input);
  }

  /** Remove a stored APK file from configured storage. */
  async cleanupStoredApk(apkUrl?: string | null): Promise<void> {
    await cleanupStoredApk(apkUrl);
  }

  /** Memvalidasi versionCode mobile agar selalu berupa integer positif. */
  private parseMobileVersionCode(value: unknown): number | null {
    if (typeof value !== "string" && typeof value !== "number") {
      return null;
    }

    const normalizedValue = String(value).trim();
    if (!/^\d+$/.test(normalizedValue)) {
      return null;
    }

    const parsedValue = Number(normalizedValue);
    return Number.isInteger(parsedValue) && parsedValue > 0
      ? parsedValue
      : null;
  }

  /**
   * Get all versions with pagination
   */
  async getAllVersions(options?: {
    page?: number;
    limit?: number;
    platform?: string;
    isActive?: boolean;
  }): Promise<{
    data: AppVersionWithUser[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const result = await this.repository.findAll(options);

    return {
      ...result,
      page,
      limit,
    };
  }

  /**
   * Get version by ID
   */
  async getVersionById(id: string): Promise<AppVersionWithUser | null> {
    return this.repository.findById(id);
  }

  async getStats(platform: string = "android"): Promise<AppVersionStatsResult> {
    const latestVersion = await this.repository.getLatestVersion(platform);

    if (!latestVersion) {
      return {
        updatedCount: 0,
        outdatedCount: 0,
        unknownCount: 0,
        latestVersion: null,
      };
    }

    const rolloutStats = await this.repository.getRolloutStatsByVersionCode(
      latestVersion.versionCode,
    );

    return {
      ...rolloutStats,
      latestVersion: {
        version: latestVersion.version,
        versionCode: latestVersion.versionCode,
      },
    };
  }

  /** Menyimpan laporan versi aplikasi dari mobile user sesuai tipe aktor. */
  async reportMobileVersion(
    input: MobileVersionReportInput,
  ): Promise<{ success: true }> {
    const parsedVersionCode = this.parseMobileVersionCode(input.versionCode);

    if (parsedVersionCode === null) {
      throw new Error("versionCode harus berupa angka bulat positif");
    }

    await this.updateVersionOwner({
      sessionUserId: input.sessionUserId,
      tenantId: input.tenantId ?? null,
      role: input.role ?? null,
      versionCode: parsedVersionCode,
      versionName: input.versionName ?? null,
    });

    return { success: true };
  }

  /**
   * Upload new app version with APK file
   * If version/buildNumber/versionCode not provided, auto-extract from APK
   */
  async uploadVersion(input: UploadVersionInput): Promise<AppVersion> {
    let version = input.version;
    let buildNumber = input.buildNumber;
    let versionCode = input.versionCode;
    let apkUrl: string | undefined;
    let apkSize = input.apkSize;
    let uploadedByService = false;

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
      if (resolvedApkSize !== undefined) {
        apkSize = resolvedApkSize;
      }
    }

    if (input.cleanupApkPath && resolvedApkPath) {
      cleanupPaths.add(resolvedApkPath);
    }

    try {
      const uploadedApk = await loadUploadedApkDetails(input);

      if (uploadedApk.apkUrl) {
        apkUrl = uploadedApk.apkUrl;
      }

      if (uploadedApk.apkSize !== undefined) {
        apkSize = uploadedApk.apkSize;
      }

      if (input.apkBuffer || resolvedApkPath || uploadedApk.apkBuffer) {
        const apkInfo = await this.parseApkInfo({
          ...(uploadedApk.apkBuffer ? { buffer: uploadedApk.apkBuffer } : {}),
          ...(input.apkBuffer ? { buffer: input.apkBuffer } : {}),
          ...(resolvedApkPath ? { path: resolvedApkPath } : {}),
        });

        if (apkInfo) {
          if (
            (version && version !== apkInfo.versionName) ||
            (buildNumber && buildNumber !== apkInfo.buildNumber) ||
            (versionCode && versionCode !== apkInfo.versionCode)
          ) {
            throw new Error(
              "Metadata versi tidak cocok dengan APK yang diupload",
            );
          }

          version = version || apkInfo.versionName;
          buildNumber = buildNumber || apkInfo.buildNumber;
          versionCode = versionCode || apkInfo.versionCode;
        } else {
          throw new Error("Gagal membaca metadata APK yang diupload");
        }
      }

      // Validate required fields
      if (!version || !buildNumber || !versionCode) {
        throw new Error(
          "Version, buildNumber, dan versionCode wajib diisi atau upload APK untuk auto-detect",
        );
      }

      // Validate version doesn't already exist
      const exists = await this.repository.exists(version, versionCode);
      if (exists.versionExists) {
        throw new Error(`Version ${version} sudah ada`);
      }
      if (exists.versionCodeExists) {
        throw new Error(`Version code ${versionCode} sudah ada`);
      }

      const filenameForUpload =
        resolvedApkFilename ?? `netmanager_v${version}.apk`;
      if (!input.uploadedKey && (input.apkBuffer || resolvedApkPath)) {
        apkUrl = await this.uploadApkFile({
          ...(input.apkBuffer ? { buffer: input.apkBuffer } : {}),
          ...(resolvedApkPath ? { path: resolvedApkPath } : {}),
          filename: filenameForUpload,
          version,
          forceLocal: input.forceLocal,
        });
        uploadedByService = true;
      }

      const createData: CreateAppVersionDTO = {
        version,
        buildNumber,
        versionCode,
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

      const result = await this.repository.create(createData);
      return result;
    } catch (error: unknown) {
      if (input.uploadedKey) {
        try {
          await deleteUploadedApkObject(input.uploadedKey);
        } catch (cleanupError) {
          logger.warn(
            "Gagal membersihkan APK direct upload setelah create versi gagal:",
            cleanupError,
          );
        }
      }

      if (uploadedByService && apkUrl) {
        try {
          await cleanupStoredApk(apkUrl);
        } catch (cleanupError) {
          logger.warn(
            "Gagal membersihkan APK setelah create versi gagal:",
            cleanupError,
          );
        }
      }

      logger.error("[AppVersionService] Error in uploadVersion:", error);
      const err = error as { message?: string };
      throw new Error(
        `Gagal mengunggah versi aplikasi: ${err?.message || "Terjadi kesalahan"}`,
      );
    } finally {
      for (const cleanupPath of cleanupPaths) {
        try {
          await fs.unlink(cleanupPath);
        } catch (cleanupError) {
          logger.warn(
            `[AppVersionService] Failed to cleanup temp APK: ${cleanupPath}`,
            cleanupError,
          );
        }
      }
    }
  }

  async createDirectUploadUrl(params: {
    filename: string;
    contentType: string;
    expiresIn?: number;
  }) {
    return createDirectUploadApkUrl(params);
  }

  /** Upload APK file to storage (R2 or local). */
  private async uploadApkFile(input: {
    buffer?: Buffer;
    path?: string;
    filename: string;
    version: string;
    forceLocal?: boolean;
  }): Promise<string> {
    return uploadApkFile(input);
  }

  /**
   * Update version info
   */
  async updateVersion(
    id: string,
    data: UpdateAppVersionDTO,
  ): Promise<AppVersion> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error("Versi tidak ditemukan");
    }

    const updateData: UpdateAppVersionDTO = {
      ...data,
      ...(data.minVersion === undefined
        ? { minVersion: existing.minVersion }
        : {}),
    };

    // Check for version conflicts if changing version or versionCode
    if (updateData.version && updateData.version !== existing.version) {
      const versionExists = await this.repository.findByVersion(
        updateData.version,
      );
      if (versionExists) {
        throw new Error(`Version ${updateData.version} sudah ada`);
      }
    }

    if (
      updateData.versionCode &&
      updateData.versionCode !== existing.versionCode
    ) {
      const codeExists = await this.repository.findByVersionCode(
        updateData.versionCode,
      );
      if (codeExists) {
        throw new Error(`Version code ${updateData.versionCode} sudah ada`);
      }
    }

    return this.repository.update(id, updateData);
  }

  /**
   * Soft delete version
   */
  async deleteVersion(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error("Versi tidak ditemukan");
    }

    // 1. Delete Physical File
    if (existing.apkUrl) {
      try {
        await this.cleanupStoredApk(existing.apkUrl);
      } catch (error) {
        logger.error("Error deleting physical APK file:", error);
        // Continue to delete DB record even if file deletion fails
      }
    }

    // 2. Hard Delete DB Record
    try {
      await this.repository.delete(id);
    } catch (error) {
      if (isPrismaRecordNotFoundError(error)) {
        throw new Error("Versi tidak ditemukan");
      }

      throw error;
    }
  }

  async evaluateVersionAccess(
    currentVersionCode: number,
    platform: string = "android",
  ): Promise<VersionAccessResult> {
    const latestVersion = await this.repository.getLatestVersion(platform);

    if (!latestVersion) {
      return {
        isSupported: true,
        updateAvailable: false,
        isForceUpdate: false,
        currentVersion: "",
        currentVersionCode,
        minimumVersion: null,
        latestVersion: null,
      };
    }

    const updateAvailable = latestVersion.versionCode > currentVersionCode;

    let isForceUpdate = false;
    if (updateAvailable && latestVersion.isForceUpdate) {
      isForceUpdate = true;
    }

    if (updateAvailable && latestVersion.minVersion) {
      const minVersionCode = this.parseVersionToCode(latestVersion.minVersion);
      if (minVersionCode && currentVersionCode < minVersionCode) {
        isForceUpdate = true;
      }
    }

    return {
      isSupported: !isForceUpdate,
      updateAvailable,
      isForceUpdate,
      currentVersion: latestVersion.version,
      currentVersionCode,
      minimumVersion: latestVersion.minVersion ?? null,
      latestVersion: updateAvailable
        ? this.mapLatestVersion(latestVersion)
        : null,
    };
  }

  /**
   * Check for available update
   */
  async checkForUpdate(
    currentVersionCode: number,
    platform: string = "android",
  ): Promise<CheckVersionResult> {
    const result = await this.evaluateVersionAccess(
      currentVersionCode,
      platform,
    );

    return {
      updateAvailable: result.updateAvailable,
      isForceUpdate: result.isForceUpdate,
      currentVersion: result.currentVersion,
      latestVersion: result.latestVersion,
    };
  }

  /** Mengupdate owner version report berdasarkan role actor mobile. */
  private async updateVersionOwner(input: {
    sessionUserId: string;
    tenantId: string | null;
    role: string | null;
    versionCode: number;
    versionName: string | null;
  }) {
    const versionPayload = this.buildVersionUpdatePayload(
      input.versionCode,
      input.versionName,
    );

    if (input.role === "CUSTOMER") {
      await prisma.pelanggan.update({
        where: {
          id: input.sessionUserId,
          tenantId: input.tenantId ?? undefined,
        },
        data: versionPayload,
      });
      return;
    }

    if (input.role === "MITRA") {
      await prismaMitra.mitra.update({
        where: { id: input.sessionUserId },
        data: versionPayload,
      });
      return;
    }

    await prisma.user.update({
      where: { id: input.sessionUserId, tenantId: input.tenantId ?? undefined },
      data: versionPayload,
    });
  }

  /** Membangun payload update version report yang konsisten. */
  private buildVersionUpdatePayload(
    versionCode: number,
    versionName: string | null,
  ) {
    return {
      lastVersionCode: versionCode,
      lastVersionName: versionName,
      lastVersionUpdate: new Date(),
    };
  }

  private mapLatestVersion(
    latestVersion: AppVersion,
  ): CheckVersionResult["latestVersion"] {
    return {
      id: latestVersion.id,
      version: latestVersion.version,
      buildNumber: latestVersion.buildNumber,
      versionCode: latestVersion.versionCode,
      releaseNotes: latestVersion.releaseNotes,
      downloadUrl: latestVersion.apkUrl
        ? latestVersion.apkUrl.startsWith("http://") ||
          latestVersion.apkUrl.startsWith("https://")
          ? latestVersion.apkUrl
          : `/api/mobile/app-version/download/${latestVersion.id}`
        : null,
      apkSize: latestVersion.apkSize ? Number(latestVersion.apkSize) : null,
    };
  }

  /**
   * Parse version string to version code (rough estimation)
   * e.g., "1.0.54" -> 10054
   */
  private parseVersionToCode(version: string): number | null {
    const parts = version.split(".");
    if (parts.length !== 3) return null;

    const major = parseInt(parts[0] ?? "0", 10);
    const minor = parseInt(parts[1] ?? "0", 10);
    const patch = parseInt(parts[2] ?? "0", 10);

    if (isNaN(major) || isNaN(minor) || isNaN(patch)) return null;

    return major * 10000 + minor * 100 + patch;
  }

  /**
   * Get APK file path for download
   */
  async getApkForDownload(id: string): Promise<{
    url: string;
    filename: string;
    size: number;
  } | null> {
    const version = await this.repository.findById(id);
    if (!version || !version.apkUrl) {
      return null;
    }

    return {
      url: version.apkUrl,
      filename: `netmanager_v${version.version}.apk`,
      size: version.apkSize ? Number(version.apkSize) : 0,
    };
  }
}
