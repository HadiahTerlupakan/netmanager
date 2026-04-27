import { decryptApiKey } from "@/lib/utils/encryption";
import { SettingsRepository } from "../repositories/SettingsRepository";
import type {
  SettingsEntity,
  SettingsUpsertEntity,
} from "../domain/entities/Settings";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";

export type TenantSettingField = {
  key: string;
  defaultValue: string;
  decryptValue?: boolean;
};

export type TenantSettingsMap = Record<string, string>;

const defaultSettingsRepository: ISettingsRepository = SettingsRepository;

/** Gets tenant settings as a key-value map with optional decryption. */
export async function getTenantSettingsMap(
  tenantId: string,
  fields: readonly TenantSettingField[],
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<TenantSettingsMap> {
  if (!fields.length) {
    return {};
  }

  const records = await repository.findManyByKeys(
    fields.map((field) => field.key),
    tenantId,
  );

  return buildTenantSettingsMap(fields, records);
}

/** Upserts tenant-scoped settings entries. */
export async function upsertTenantSettings(
  tenantId: string,
  entries: ReadonlyArray<Omit<SettingsUpsertEntity, "tenantId">>,
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<void> {
  if (!entries.length) {
    return;
  }

  await repository.upsertMany(entries.map((entry) => ({ ...entry, tenantId })));
}

function buildTenantSettingsMap(
  fields: readonly TenantSettingField[],
  records: SettingsEntity[],
): TenantSettingsMap {
  const recordMap = new Map(records.map((record) => [record.key, record]));
  const output: TenantSettingsMap = {};

  for (const field of fields) {
    output[field.key] = resolveTenantSettingValue(
      field,
      recordMap.get(field.key),
    );
  }

  return output;
}

function resolveTenantSettingValue(
  field: TenantSettingField,
  record?: SettingsEntity,
): string {
  if (!record?.value) {
    return field.defaultValue;
  }

  if (!field.decryptValue || !record.encrypted) {
    return record.value;
  }

  return decryptTenantSettingValue(field, record.value);
}

function decryptTenantSettingValue(
  field: TenantSettingField,
  value: string,
): string {
  try {
    return decryptApiKey(value);
  } catch (error) {
    console.error(
      `[tenantSettings] Failed to decrypt key ${field.key}:`,
      error,
    );
    return field.defaultValue;
  }
}
