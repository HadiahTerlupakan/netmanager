import type { AppVersionRolloutStats } from "../domain/entities/AppVersionEntity";

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
