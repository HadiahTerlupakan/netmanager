import type { AppVersion } from "../domain/entities/AppVersionEntity";
import type { IAppVersionRepository } from "../domain/ports/IAppVersionRepository";
import type {
  CheckVersionResult,
  VersionAccessResult,
} from "./AppVersionService.types";

import { DEFAULT_PLATFORM, EMPTY_VERSION_LABEL } from "./app-version.constants";

const VERSION_PART_MULTIPLIERS = [10000, 100, 1] as const;

export class AppVersionAccessService {
  constructor(private readonly repository: IAppVersionRepository) {}

  /** Evaluasi apakah versi mobile saat ini masih didukung. */
  async evaluateVersionAccess(
    currentVersionCode: number,
    platform: string = DEFAULT_PLATFORM,
  ): Promise<VersionAccessResult> {
    const latestVersion = await this.repository.getLatestVersion(platform);
    if (!latestVersion)
      return this.getSupportedVersionResult(currentVersionCode);
    const updateAvailable = latestVersion.versionCode > currentVersionCode;
    const isForceUpdate = this.isForceUpdateRequired(
      latestVersion,
      currentVersionCode,
      updateAvailable,
    );

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

  /** Check update tersedia untuk response mobile lama. */
  async checkForUpdate(
    currentVersionCode: number,
    platform: string = DEFAULT_PLATFORM,
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

  private getSupportedVersionResult(
    currentVersionCode: number,
  ): VersionAccessResult {
    return {
      isSupported: true,
      updateAvailable: false,
      isForceUpdate: false,
      currentVersion: EMPTY_VERSION_LABEL,
      currentVersionCode,
      minimumVersion: null,
      latestVersion: null,
    };
  }

  private isForceUpdateRequired(
    latestVersion: AppVersion,
    currentVersionCode: number,
    updateAvailable: boolean,
  ) {
    if (updateAvailable && latestVersion.isForceUpdate) return true;
    if (!updateAvailable || !latestVersion.minVersion) return false;
    const minVersionCode = this.parseVersionToCode(latestVersion.minVersion);
    return Boolean(minVersionCode && currentVersionCode < minVersionCode);
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
      downloadUrl: this.resolveDownloadUrl(latestVersion),
      apkSize: latestVersion.apkSize ? Number(latestVersion.apkSize) : null,
    };
  }

  private resolveDownloadUrl(latestVersion: AppVersion) {
    if (!latestVersion.apkUrl) return null;
    return latestVersion.apkUrl.startsWith("http://") ||
      latestVersion.apkUrl.startsWith("https://")
      ? latestVersion.apkUrl
      : `/api/mobile/app-version/download/${latestVersion.id}`;
  }

  private parseVersionToCode(version: string): number | null {
    const parts = version.split(".");
    if (parts.length !== VERSION_PART_MULTIPLIERS.length) return null;
    const parsedParts = parts.map((part) => parseInt(part, 10));
    if (parsedParts.some((part) => Number.isNaN(part))) return null;
    return parsedParts.reduce(
      (total, part, index) => total + part * VERSION_PART_MULTIPLIERS[index],
      0,
    );
  }
}
