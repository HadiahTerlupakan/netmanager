import type {
  AppRelease,
  AppReleasePlatform,
} from "../domain/entities/AppReleaseEntity";
import type { IAppReleaseRepository } from "../domain/ports/IAppReleaseRepository";
import {
  isMobileVersionSupported,
  type MinimumMobileVersion,
} from "./mobile-version-policy";

/** Halaman aplikasi di Play Store; satu-satunya jalan resmi untuk upgrade. */
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.netmanager.mobile";

/** Rilis produksi Play terbaru dan versi minimum yang sedang berlaku. */
export type PlayStoreLookup = () => Promise<{
  latest: {
    versionCode: number;
    versionName: string | null;
    firstSeenAt: Date;
  } | null;
  minimum: MinimumMobileVersion | null;
}>;

export interface VersionCheckInput {
  platform: AppReleasePlatform;
  currentVersion: string;
  currentVersionCode: number;
  tenantId?: string;
}

export interface ContactAdminInfo {
  url: string;
  label: string | null;
}

export interface LatestVersionInfo {
  version: string;
  versionCode: number;
  releaseNotes: string | null;
  downloadUrl: string;
  apkSizeBytes: number | null;
  releasedAt: string;
}

export interface VersionCheckResult {
  updateAvailable: boolean;
  isForceUpdate: boolean;
  currentVersion: string;
  latestVersion: LatestVersionInfo | null;
  contactAdmin: ContactAdminInfo | null;
}

export type TenantContactLookup = (
  tenantId?: string,
) => Promise<{ url: string | null; label: string | null }>;

/** Core business logic untuk memeriksa apakah versi aplikasi perlu diupdate. */
export class AppVersionCheckService {
  constructor(
    private readonly repository: IAppReleaseRepository,
    private readonly contactLookup: TenantContactLookup,
    private readonly playStoreLookup?: PlayStoreLookup,
  ) {}

  /** Periksa apakah versi saat ini perlu diupdate berdasarkan release terbaru. */
  async check(input: VersionCheckInput): Promise<VersionCheckResult> {
    const playResult = await this.checkPlayStore(input);
    if (playResult) return playResult;

    const [latest, tenantContact] = await Promise.all([
      this.repository.findLatestActive({
        platform: input.platform,
        tenantId: input.tenantId,
      }),
      this.contactLookup(input.tenantId),
    ]);

    if (!latest) {
      return this.buildResult(input.currentVersion, null, false, tenantContact);
    }

    const updateAvailable =
      input.currentVersionCode < latest.versionCode ||
      (input.currentVersionCode === latest.versionCode &&
        compareSemver(input.currentVersion, latest.version) < 0);
    if (!updateAvailable) {
      return this.buildResult(input.currentVersion, null, false, tenantContact);
    }

    const isForceUpdate = this.resolveForceUpdate(input.currentVersion, latest);

    return this.buildResult(
      input.currentVersion,
      latest,
      isForceUpdate,
      tenantContact,
    );
  }

  /**
   * Rilis produksi Play Store didahulukan dari rilis APK manual: aplikasi di
   * bawah versi minimum diwajibkan update (server juga menolak API-nya), dan
   * yang tertinggal tetapi masih dalam masa tenggang diberi tahu. Null bila
   * tidak ada yang perlu diberitahukan dari Play.
   */
  private async checkPlayStore(
    input: VersionCheckInput,
  ): Promise<VersionCheckResult | null> {
    if (input.platform !== "android" || !this.playStoreLookup) return null;
    const { latest, minimum } = await this.playStoreLookup();
    if (!latest) return null;

    const current = {
      versionCode: input.currentVersionCode,
      versionName: input.currentVersion,
    };
    const isForceUpdate = !isMobileVersionSupported(current, minimum);
    const isBehind = !isMobileVersionSupported(current, latest);
    if (!isForceUpdate && !isBehind) return null;

    const tenantContact = await this.contactLookup(input.tenantId);
    return {
      updateAvailable: true,
      isForceUpdate,
      currentVersion: input.currentVersion,
      latestVersion: {
        version: latest.versionName ?? "",
        versionCode: latest.versionCode,
        releaseNotes: null,
        downloadUrl: PLAY_STORE_URL,
        apkSizeBytes: null,
        releasedAt: latest.firstSeenAt.toISOString(),
      },
      contactAdmin: tenantContact.url
        ? { url: tenantContact.url, label: tenantContact.label }
        : null,
    };
  }

  /** Tentukan apakah update bersifat wajib berdasarkan flag atau minSupportedVersion. */
  private resolveForceUpdate(
    currentVersion: string,
    latest: AppRelease,
  ): boolean {
    if (latest.isForceUpdate) return true;
    if (
      latest.minSupportedVersion &&
      compareSemver(currentVersion, latest.minSupportedVersion) < 0
    ) {
      return true;
    }
    return false;
  }

  /** Bangun VersionCheckResult dari data yang sudah diproses. */
  private buildResult(
    currentVersion: string,
    latest: AppRelease | null,
    isForceUpdate: boolean,
    tenantContact: { url: string | null; label: string | null },
  ): VersionCheckResult {
    return {
      updateAvailable: latest !== null,
      isForceUpdate,
      currentVersion,
      latestVersion: latest
        ? {
            version: latest.version,
            versionCode: latest.versionCode,
            releaseNotes: latest.releaseNotes,
            downloadUrl: latest.downloadUrl,
            // apkSizeBytes: bigint di domain, number di output API (ukuran APK < Number.MAX_SAFE_INTEGER)
            apkSizeBytes:
              latest.apkSizeBytes !== null ? Number(latest.apkSizeBytes) : null,
            releasedAt: latest.releasedAt.toISOString(),
          }
        : null,
      contactAdmin: tenantContact.url
        ? { url: tenantContact.url, label: tenantContact.label }
        : null,
    };
  }
}

/** Bandingkan dua versi semver. Return negatif jika a < b, positif jika a > b, 0 jika sama. */
function compareSemver(a: string, b: string): number {
  const partsA = parseSemver(a);
  const partsB = parseSemver(b);
  for (let i = 0; i < 3; i += 1) {
    if (partsA[i] !== partsB[i]) {
      return partsA[i] < partsB[i] ? -1 : 1;
    }
  }
  return 0;
}

/** Parse string semver menjadi tuple [major, minor, patch]. */
function parseSemver(value: string): [number, number, number] {
  const cleaned = value.split(/[-+]/)[0];
  const [major = 0, minor = 0, patch = 0] = cleaned
    .split(".")
    .map((part) => Number(part) || 0);
  return [major, minor, patch];
}
