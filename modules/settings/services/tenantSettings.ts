import { decryptApiKey } from '@/lib/utils/encryption'
import { SettingsRepository, type SettingsUpsertInput } from '../repositories/SettingsRepository'

export type TenantSettingField = {
  key: string
  defaultValue: string
  decryptValue?: boolean
}

export type TenantSettingsMap = Record<string, string>

export async function getTenantSettingsMap(
  tenantId: string,
  fields: readonly TenantSettingField[]
): Promise<TenantSettingsMap> {
  if (!fields.length) {
    return {}
  }

  const records = await SettingsRepository.findManyByKeys(
    fields.map((field) => field.key),
    tenantId
  )

  const recordMap = new Map(records.map((record) => [record.key, record]))
  const output: TenantSettingsMap = {}

  for (const field of fields) {
    const record = recordMap.get(field.key)
    if (!record?.value) {
      output[field.key] = field.defaultValue
      continue
    }

    if (field.decryptValue && record.encrypted) {
      try {
        output[field.key] = decryptApiKey(record.value)
      } catch (error) {
        console.error(`[tenantSettings] Failed to decrypt key ${field.key}:`, error)
        output[field.key] = field.defaultValue
      }
      continue
    }

    output[field.key] = record.value
  }

  return output
}

export async function upsertTenantSettings(
  tenantId: string,
  entries: ReadonlyArray<Omit<SettingsUpsertInput, 'tenantId'>>
): Promise<void> {
  if (!entries.length) {
    return
  }

  await SettingsRepository.upsertMany(entries.map((entry) => ({ ...entry, tenantId })))
}
