import { logger } from "@/lib/logger";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";

import type {
  AppVersion,
  AppVersionWithUser,
  UpdateAppVersionDTO,
} from "../domain/entities/AppVersionEntity";
import type { IAppVersionRepository } from "../domain/ports/IAppVersionRepository";
import { AppVersionAccessService } from "./AppVersionAccessService";
import {
  AppVersionReportService,
  type MobileVersionReportInput,
} from "./AppVersionReportService";
import type {
  AppVersionStatsResult,
  CheckVersionResult,
  UploadVersionInput,
  VersionAccessResult,
} from "./AppVersionService.types";
import { AppVersionUploadService } from "./AppVersionUploadService";
import {
  buildVersionPaginationResult,
  buildEmptyVersionStats,
  buildVersionStatsResult,
  requireExistingVersion,
  buildUpdatePayload,
  assertVersionUpdateHasNoConflict,
  buildDownloadApkPayload,
} from "./app-version-update.helpers";
import {
  cleanupStoredApk,
  createDirectUploadUrl as createDirectUploadApkUrl,
} from "./app-version-storage.helpers";
import { parseApkInfo, type ParsedApkInfo } from "./app-version-parse.helpers";
import { DEFAULT_PLATFORM } from "./app-version.constants";

export type { MobileVersionReportInput };
export type {
  AppVersionStatsResult,
  CheckVersionResult,
  UploadVersionInput,
  VersionAccessResult,
};
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

  /** Parse metadata APK dari file path atau buffer. */
  async parseApkInfo(input: {
    buffer?: Buffer;
    path?: string;
  }): Promise<ParsedApkInfo | null> {
    return parseApkInfo(input);
  }

  /** Hapus file APK yang tersimpan dari storage aktif. */
  async cleanupStoredApk(apkUrl?: string | null): Promise<void> {
    await cleanupStoredApk(apkUrl);
  }

  /** Ambil daftar versi dengan metadata pagination. */
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
    const result = await this.repository.findAll(options);
    return buildVersionPaginationResult(result, options);
  }

  /** Ambil detail versi berdasarkan ID. */
  async getVersionById(id: string): Promise<AppVersionWithUser | null> {
    return this.repository.findById(id);
  }

  /** Ambil statistik rollout versi terbaru per platform. */
  async getStats(
    platform: string = DEFAULT_PLATFORM,
  ): Promise<AppVersionStatsResult> {
    const latestVersion = await this.repository.getLatestVersion(platform);
    if (!latestVersion) {
      return buildEmptyVersionStats();
    }

    const rolloutStats = await this.repository.getRolloutStatsByVersionCode(
      latestVersion.versionCode,
    );
    return buildVersionStatsResult(latestVersion, {
      ...rolloutStats,
      latestVersion: null,
    });
  }

  /** Simpan laporan versi aplikasi mobile dari aktor yang login. */
  async reportMobileVersion(
    input: MobileVersionReportInput,
  ): Promise<{ success: true }> {
    return this.reportService.reportMobileVersion(input);
  }

  /** Upload versi aplikasi baru beserta APK dan metadata. */
  async uploadVersion(input: UploadVersionInput): Promise<AppVersion> {
    return this.uploadService.uploadVersion(input);
  }

  /** Buat direct upload URL untuk APK baru. */
  async createDirectUploadUrl(params: {
    filename: string;
    contentType: string;
    expiresIn?: number;
  }) {
    return createDirectUploadApkUrl(params);
  }

  /** Update versi aplikasi setelah validasi konflik. */
  async updateVersion(
    id: string,
    data: UpdateAppVersionDTO,
  ): Promise<AppVersion> {
    const existing = await requireExistingVersion(this.repository, id);
    const updateData = buildUpdatePayload(data, existing);
    await assertVersionUpdateHasNoConflict(
      this.repository,
      updateData,
      existing,
    );
    return this.repository.update(id, updateData);
  }

  /** Hapus versi aplikasi dan bersihkan APK fisiknya. */
  async deleteVersion(id: string): Promise<void> {
    const existing = await requireExistingVersion(this.repository, id);
    await this.cleanupExistingApk(existing);

    try {
      await this.repository.delete(id);
    } catch (error) {
      if (isPrismaRecordNotFoundError(error)) {
        throw new Error("Versi tidak ditemukan");
      }
      throw error;
    }
  }

  /** Evaluasi apakah versi mobile saat ini masih didukung. */
  async evaluateVersionAccess(
    currentVersionCode: number,
    platform: string = DEFAULT_PLATFORM,
  ): Promise<VersionAccessResult> {
    return this.accessService.evaluateVersionAccess(
      currentVersionCode,
      platform,
    );
  }

  /** Cek ketersediaan update untuk aplikasi mobile. */
  async checkForUpdate(
    currentVersionCode: number,
    platform: string = DEFAULT_PLATFORM,
  ): Promise<CheckVersionResult> {
    return this.accessService.checkForUpdate(currentVersionCode, platform);
  }

  /** Ambil informasi file APK untuk endpoint download. */
  async getApkForDownload(
    id: string,
  ): Promise<{ url: string; filename: string; size: number } | null> {
    const version = await this.repository.findById(id);
    if (!version?.apkUrl) {
      return null;
    }

    return buildDownloadApkPayload(version);
  }

  private async cleanupExistingApk(
    existing: AppVersionWithUser,
  ): Promise<void> {
    if (!existing.apkUrl) {
      return;
    }

    try {
      await this.cleanupStoredApk(existing.apkUrl);
    } catch (error) {
      logger.error("Error deleting physical APK file:", error);
    }
  }
}
