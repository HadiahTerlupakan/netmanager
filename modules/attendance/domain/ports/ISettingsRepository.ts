import type { SettingEntity } from "../entities/SettingEntity";

export interface ISettingsRepository {
  /** Find single setting by key. */
  findByKey(key: string, tenantId?: string): Promise<SettingEntity | null>;

  /** Find multiple settings by keys. */
  findManyByKeys(keys: string[]): Promise<SettingEntity[]>;
}
