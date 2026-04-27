import type { Prisma, User } from "@prisma/client";

export type AppVersion = Prisma.AppVersionGetPayload<Record<string, never>>;

export type AppVersionWithUser = AppVersion & {
  user: Pick<User, "id" | "name" | "email"> | null;
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
