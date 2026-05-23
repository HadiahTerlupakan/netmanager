import type { SettingEntity } from "../entities/SettingEntity";

export interface ISettingsRepository {
  /** Find single setting by key. */
  findByKey(key: string, tenantId?: string): Promise<SettingEntity | null>;

  /** Find multiple settings by keys, opsional di-scope ke tenant tertentu. */
  findManyByKeys(keys: string[], tenantId?: string): Promise<SettingEntity[]>;
}
