import { SettingsRepository } from '../repositories/SettingsRepository'

const PUBLIC_SETTINGS_KEYS = [
  'GENERAL_NAMA_APLIKASI',
  'GENERAL_PERUSAHAAN',
  'LOGO_APLIKASI',
  'LOGO_INVOICE',
] as const

export type PublicPortalSettingsPayload = {
  namaAplikasi: string
  perusahaan: string
  logoAplikasi: string | null
  logoInvoice: string | null
}

export async function getPublicPortalSettings(): Promise<PublicPortalSettingsPayload> {
  const records = await SettingsRepository.findManyByKeys(PUBLIC_SETTINGS_KEYS)
  const settingsMap = new Map(records.map((setting) => [setting.key, setting.value]))

  return {
    namaAplikasi: settingsMap.get('GENERAL_NAMA_APLIKASI') || 'NetManager',
    perusahaan: settingsMap.get('GENERAL_PERUSAHAAN') || '',
    logoAplikasi: settingsMap.get('LOGO_APLIKASI') || null,
    logoInvoice: settingsMap.get('LOGO_INVOICE') || null,
  }
}
