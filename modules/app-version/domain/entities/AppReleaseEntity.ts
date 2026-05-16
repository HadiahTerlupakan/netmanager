export type AppReleasePlatform = "android" | "ios";
export type AppReleaseArchitecture =
  | "arm64-v8a"
  | "armeabi-v7a"
  | "x86_64"
  | "universal";

export interface AppRelease {
  id: string;
  platform: AppReleasePlatform;
  version: string;
  versionCode: number;
  isForceUpdate: boolean;
  minSupportedVersion: string | null;
  downloadUrl: string;
  releaseNotes: string | null;
  isActive: boolean;
  releasedAt: Date;
  architecture: AppReleaseArchitecture | null;
  minOsVersion: string | null;
  rolloutPercentage: number;
  apkSizeBytes: bigint | null;
  tenantId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}
