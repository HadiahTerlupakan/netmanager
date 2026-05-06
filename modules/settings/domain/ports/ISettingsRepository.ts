import type {
  SettingsEntity,
  SettingsUpsertEntity,
} from "../entities/Settings";

export interface ISettingsRepository {
  findManyByKeys(
    keys: ReadonlyArray<string>,
    tenantId?: string | null,
  ): Promise<SettingsEntity[]>;

  upsertMany(entries: SettingsUpsertEntity[]): Promise<void>;

  createMany(entries: SettingsUpsertEntity[]): Promise<void>;

  updateMany(entries: SettingsUpsertEntity[]): Promise<void>;

  deleteManyByKeys(
    keys: ReadonlyArray<string>,
    tenantId?: string | null,
  ): Promise<void>;
}
