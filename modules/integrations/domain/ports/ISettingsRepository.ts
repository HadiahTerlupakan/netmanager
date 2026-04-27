import type { AppSettingEntity } from "../entities/AppSettingEntity";

export interface ISettingsRepository {
  findByKey(key: string): Promise<AppSettingEntity | null>;
}
