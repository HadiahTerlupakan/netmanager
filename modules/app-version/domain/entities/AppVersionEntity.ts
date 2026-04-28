export interface AppVersion {
  id: string;
  version: string;
  buildNumber: number;
  versionCode: number;
  platform: string;
  apkUrl: string | null;
  apkSize: bigint | null;
  releaseNotes: string | null;
  isForceUpdate: boolean;
  minVersion: string | null;
  isActive: boolean;
  publishedAt: Date | null;
  createdBy: string | null;
  tenantId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AppVersionWithUser = AppVersion & {
  user: { id: string; name: string | null; email: string } | null;
};

export interface CreateAppVersionDTO {
  version: string;
  buildNumber: number;
  versionCode: number;
  platform?: string;
  apkUrl?: string;
  apkSize?: bigint;
  releaseNotes?: string;
  isForceUpdate?: boolean;
  minVersion?: string;
  isActive?: boolean;
  publishedAt?: Date;
  createdBy?: string;
}

export interface UpdateAppVersionDTO {
  version?: string;
  buildNumber?: number;
  versionCode?: number;
  platform?: string;
  apkUrl?: string;
  apkSize?: bigint;
  releaseNotes?: string;
  isForceUpdate?: boolean;
  minVersion?: string;
  isActive?: boolean;
  publishedAt?: Date;
}

export interface AppVersionRolloutStats {
  updatedCount: number;
  outdatedCount: number;
  unknownCount: number;
}
