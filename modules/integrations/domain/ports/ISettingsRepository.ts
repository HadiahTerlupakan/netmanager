import type { AppSettingEntity } from "../entities/AppSettingEntity";

export interface UpsertSettingInput {
  key: string;
  value: string;
  description?: string;
}

export interface ISettingsRepository {
  findByKey(key: string): Promise<AppSettingEntity | null>;
  upsertByKey(input: UpsertSettingInput): Promise<AppSettingEntity>;
}
