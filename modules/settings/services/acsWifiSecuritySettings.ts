import {
  AcsSettingsRepository,
  normalizeAcsWifiSecurityPayload,
  type AcsWifiSecurityInput,
} from '../repositories/AcsSettingsRepository'

export async function listAcsWifiSecurityConfigs(tenantId?: string | null) {
  return AcsSettingsRepository.findWifiSecurityByTenant(tenantId ?? null)
}

export async function upsertAcsWifiSecurity(payload: AcsWifiSecurityInput, tenantId?: string | null) {
  return AcsSettingsRepository.upsertWifiSecurityByTenantAndProductClass(
    tenantId ?? null,
    normalizeAcsWifiSecurityPayload(payload)
  )
}

export async function updateAcsWifiSecurity(id: string, payload: AcsWifiSecurityInput) {
  return AcsSettingsRepository.updateWifiSecurity(id, normalizeAcsWifiSecurityPayload(payload))
}

export async function deleteAcsWifiSecurity(id: string) {
  await AcsSettingsRepository.deleteWifiSecurity(id)
}
