import { logger } from "@/lib/logger";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  AppVersion,
  AppVersionRolloutStats,
  AppVersionWithUser,
  UpdateAppVersionDTO,
} from "../domain/entities/AppVersionEntity";
import type { IAppVersionRepository } from "../domain/ports/IAppVersionRepository";
import {
  cleanupStoredApk,
  createDirectUploadUrl as createDirectUploadApkUrl,
  parseApkInfo as parseUploadedApkInfo,
  type ParsedApkInfo,
} from "./app-version-upload-helpers";
import { AppVersionAccessService } from "./AppVersionAccessService";
import {
  AppVersionReportService,
  type MobileVersionReportInput,
} from "./AppVersionReportService";
import { AppVersionUploadService } from "./AppVersionUploadService";

export interface UploadVersionInput {
  version?: string;
  buildNumber?: number;
  versionCode?: number;
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
  latestVersion: { version: string; versionCode: number } | null;
}

export type { MobileVersionReportInput };
export { getAppVersionService } from "../factories/app-version-service-factory";

export class AppVersionService {
  private readonly accessService: AppVersionAccessService;
  private readonly reportService: AppVersionReportService;
  private readonly uploadService: AppVersionUploadService;

  constructor(private readonly repository: IAppVersionRepository) {
    this.accessService = new AppVersionAccessService(repository);
    this.reportService = new AppVersionReportService();
    this.uploadService = new AppVersionUploadService(repository, (input) =>
      this.parseApkInfo(input),
    );
  }

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

  /** Get all versions with pagination metadata. */
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
    return { ...result, page, limit };
  }

  /** Get version by ID. */
  async getVersionById(id: string): Promise<AppVersionWithUser | null> {
    return this.repository.findById(id);
  }

  /** Ambil statistik rollout versi terbaru per platform. */
  async getStats(platform: string = "android"): Promise<AppVersionStatsResult> {
    const latestVersion = await this.repository.getLatestVersion(platform);
    if (!latestVersion) return this.getEmptyStats();
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
    return this.reportService.reportMobileVersion(input);
  }

  /** Upload new app version with APK metadata extraction. */
  async uploadVersion(input: UploadVersionInput): Promise<AppVersion> {
    return this.uploadService.uploadVersion(input);
  }

  /** Buat direct upload URL untuk APK. */
  async createDirectUploadUrl(params: {
    filename: string;
    contentType: string;
    expiresIn?: number;
  }) {
    return createDirectUploadApkUrl(params);
  }

  /** Update version info and validate conflicts. */
  async updateVersion(
    id: string,
    data: UpdateAppVersionDTO,
  ): Promise<AppVersion> {
    const existing = await this.getExistingVersion(id);
    const updateData = this.buildUpdateData(data, existing);
    await this.assertUpdateHasNoConflict(updateData, existing);
    return this.repository.update(id, updateData);
  }

  /** Delete version and cleanup APK file when available. */
  async deleteVersion(id: string): Promise<void> {
    const existing = await this.getExistingVersion(id);
    await this.cleanupExistingApk(existing);
    try {
      await this.repository.delete(id);
    } catch (error) {
      if (isPrismaRecordNotFoundError(error))
        throw new Error("Versi tidak ditemukan");
      throw error;
    }
  }

  /** Evaluasi apakah versi mobile saat ini masih didukung. */
  async evaluateVersionAccess(
    currentVersionCode: number,
    platform: string = "android",
  ): Promise<VersionAccessResult> {
    return this.accessService.evaluateVersionAccess(
      currentVersionCode,
      platform,
    );
  }

  /** Check for available mobile update. */
  async checkForUpdate(
    currentVersionCode: number,
    platform: string = "android",
  ): Promise<CheckVersionResult> {
    return this.accessService.checkForUpdate(currentVersionCode, platform);
  }

  /** Get APK file path for download. */
  async getApkForDownload(
    id: string,
  ): Promise<{ url: string; filename: string; size: number } | null> {
    const version = await this.repository.findById(id);
    if (!version?.apkUrl) return null;
    return {
      url: version.apkUrl,
      filename: `netmanager_v${version.version}.apk`,
      size: version.apkSize ? Number(version.apkSize) : 0,
    };
  }

  private getEmptyStats(): AppVersionStatsResult {
    return {
      updatedCount: 0,
      outdatedCount: 0,
      unknownCount: 0,
      latestVersion: null,
    };
  }

  private async getExistingVersion(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new Error("Versi tidak ditemukan");
    return existing;
  }

  private buildUpdateData(
    data: UpdateAppVersionDTO,
    existing: AppVersionWithUser,
  ) {
    return {
      ...data,
      ...(data.minVersion === undefined
        ? { minVersion: existing.minVersion }
        : {}),
    };
  }

  private async assertUpdateHasNoConflict(
    updateData: UpdateAppVersionDTO,
    existing: AppVersionWithUser,
  ) {
    if (updateData.version && updateData.version !== existing.version) {
      const versionExists = await this.repository.findByVersion(
        updateData.version,
      );
      if (versionExists)
        throw new Error(`Version ${updateData.version} sudah ada`);
    }
    if (
      updateData.versionCode &&
      updateData.versionCode !== existing.versionCode
    ) {
      const codeExists = await this.repository.findByVersionCode(
        updateData.versionCode,
      );
      if (codeExists)
        throw new Error(`Version code ${updateData.versionCode} sudah ada`);
    }
  }

  private async cleanupExistingApk(existing: AppVersionWithUser) {
    if (!existing.apkUrl) return;
    try {
      await this.cleanupStoredApk(existing.apkUrl);
    } catch (error) {
      logger.error("Error deleting physical APK file:", error);
    }
  }
}
