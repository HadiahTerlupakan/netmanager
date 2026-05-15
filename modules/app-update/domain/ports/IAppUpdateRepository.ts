import type {
  AppUpdate,
  AppUpdateChannel,
  AppUpdatePlatform,
  CreateAppUpdateDTO,
} from "../entities/AppUpdateEntity";

export interface IAppUpdateRepository {
  /** Cari update aktif terbaru untuk kombinasi channel + runtime + platform. */
  findLatestActive(query: {
    channel: AppUpdateChannel;
    runtimeVersion: string;
    platform: AppUpdatePlatform;
  }): Promise<AppUpdate | null>;

  /** Daftar update untuk admin panel, paginated. */
  findAll(options?: {
    channel?: AppUpdateChannel;
    platform?: AppUpdatePlatform;
    page?: number;
    limit?: number;
  }): Promise<{ data: AppUpdate[]; total: number }>;

  findById(id: string): Promise<AppUpdate | null>;

  create(data: CreateAppUpdateDTO): Promise<AppUpdate>;

  setActive(id: string, isActive: boolean): Promise<AppUpdate>;

  delete(id: string): Promise<void>;
}
