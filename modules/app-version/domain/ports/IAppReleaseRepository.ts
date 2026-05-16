import type {
  AppRelease,
  AppReleasePlatform,
} from "../entities/AppReleaseEntity";

export interface AppReleaseQueryFilters {
  platform?: AppReleasePlatform;
  isActive?: boolean;
  tenantId?: string;
  skip?: number;
  take?: number;
}

export interface AppReleaseCreateInput {
  platform: AppReleasePlatform;
  version: string;
  versionCode: number;
  isForceUpdate?: boolean;
  minSupportedVersion?: string | null;
  downloadUrl: string;
  releaseNotes?: string | null;
  isActive?: boolean;
  architecture?: string | null;
  minOsVersion?: string | null;
  rolloutPercentage?: number;
  apkSizeBytes?: bigint | null;
  tenantId?: string | null;
  createdBy?: string | null;
}

export interface AppReleaseUpdateInput {
  isActive?: boolean;
  isForceUpdate?: boolean;
  minSupportedVersion?: string | null;
  downloadUrl?: string;
  releaseNotes?: string | null;
  rolloutPercentage?: number;
  architecture?: string | null;
  minOsVersion?: string | null;
  apkSizeBytes?: bigint | null;
}

export interface IAppReleaseRepository {
  findLatestActive(query: {
    platform: AppReleasePlatform;
    tenantId?: string;
  }): Promise<AppRelease | null>;
  findById(id: string): Promise<AppRelease | null>;
  findAll(filters: AppReleaseQueryFilters): Promise<AppRelease[]>;
  count(filters: AppReleaseQueryFilters): Promise<number>;
  create(data: AppReleaseCreateInput): Promise<AppRelease>;
  update(id: string, data: AppReleaseUpdateInput): Promise<AppRelease>;
  delete(id: string): Promise<void>;
}
