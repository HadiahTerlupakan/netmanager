import { decryptApiKey, encryptApiKey } from '@/lib/utils/encryption'
import { SettingsRepository, type SettingsRecord, type SettingsUpsertInput } from '../repositories/SettingsRepository'

export type CaptchaSettingsPayload = {
  enabled: boolean
  siteKey: string
  secretKey: string
}

const CAPTCHA_SETTINGS_KEYS = ['captcha_enabled', 'captcha_site_key', 'captcha_secret_key'] as const

export function mapCaptchaSettingsResponse(records: SettingsRecord[]): CaptchaSettingsPayload {
  const settingsMap = new Map(records.map((record) => [record.key, record.value]))
  const secretRecord = records.find((record) => record.key === 'captcha_secret_key')

  let secretKey = secretRecord?.value || ''
  if (secretRecord?.value && secretRecord.encrypted) {
    secretKey = decryptApiKey(secretRecord.value)
  }

  return {
    enabled: settingsMap.get('captcha_enabled') === 'true',
    siteKey: settingsMap.get('captcha_site_key') || '',
    secretKey,
  }
}

export function buildCaptchaSettingsUpserts(payload: CaptchaSettingsPayload): SettingsUpsertInput[] {
  const normalizedSecretKey = payload.secretKey.trim()
  const encryptedSecretKey = normalizedSecretKey ? encryptApiKey(normalizedSecretKey) : null

  return [
    {
      key: 'captcha_enabled',
      value: String(payload.enabled),
      description: 'Enable/Disable Cloudflare Turnstile',
      encrypted: false,
    },
    {
      key: 'captcha_site_key',
      value: payload.siteKey.trim(),
      description: 'Cloudflare Turnstile Site Key',
      encrypted: false,
    },
    {
      key: 'captcha_secret_key',
      value: encryptedSecretKey,
      description: 'Cloudflare Turnstile Secret Key',
      encrypted: Boolean(encryptedSecretKey),
    },
  ]
}

export async function getCaptchaSettings(): Promise<CaptchaSettingsPayload> {
  const records = await SettingsRepository.findManyByKeys(CAPTCHA_SETTINGS_KEYS)
  return mapCaptchaSettingsResponse(records)
}

export async function saveCaptchaSettings(payload: CaptchaSettingsPayload): Promise<void> {
  await SettingsRepository.upsertMany(buildCaptchaSettingsUpserts(payload))
}
