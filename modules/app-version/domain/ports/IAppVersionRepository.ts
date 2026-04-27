import type {
  AppVersion,
  AppVersionRolloutStats,
  AppVersionWithUser,
  CreateAppVersionDTO,
  UpdateAppVersionDTO,
} from "../entities/AppVersionEntity";

export interface IAppVersionRepository {
  findAll(options?: {
    page?: number;
    limit?: number;
    platform?: string;
    isActive?: boolean;
  }): Promise<{ data: AppVersionWithUser[]; total: number }>;
  findById(id: string): Promise<AppVersionWithUser | null>;
  findByVersion(version: string): Promise<AppVersion | null>;
  findByVersionCode(versionCode: number): Promise<AppVersion | null>;
  getLatestVersion(platform?: string): Promise<AppVersion | null>;
  getRolloutStatsByVersionCode(
    versionCode: number,
  ): Promise<AppVersionRolloutStats>;
  create(data: CreateAppVersionDTO): Promise<AppVersion>;
  update(id: string, data: UpdateAppVersionDTO): Promise<AppVersion>;
  softDelete(id: string): Promise<AppVersion>;
  delete(id: string): Promise<void>;
  exists(
    version: string,
    versionCode: number,
  ): Promise<{
    versionExists: boolean;
    versionCodeExists: boolean;
  }>;
}
