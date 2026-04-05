import { decryptApiKey, encryptApiKey } from '@/lib/utils/encryption'
import type { SettingsRecord, SettingsUpsertInput } from '../repositories/SettingsRepository'

export type ApiSettingsPayload = {
  googleGeminiApiKey: string
  geminiEnabled: boolean
  r2AccountId: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
  r2BucketName: string
  r2PublicUrl: string
  r2Enabled: boolean
}

export type ApiSettingsPostPayload = Partial<ApiSettingsPayload>

export const API_SETTINGS_KEYS: string[] = [
  'GOOGLE_GEMINI_API_KEY',
  'GEMINI_ENABLED',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
  'R2_ENABLED',
] as const

function getSettingValue(records: SettingsRecord[], key: string): string {
  const setting = records.find((item) => item.key === key)
  if (!setting?.value) {
    return ''
  }

  if (setting.encrypted) {
    try {
      return decryptApiKey(setting.value)
    } catch (error) {
      console.error(`[apiSettings] Failed to decrypt setting key: ${key}`, error)
      return ''
    }
  }

  return setting.value
}

export function mapApiSettingsResponse(records: SettingsRecord[]): ApiSettingsPayload {
  const settingsMap = new Map(records.map((setting) => [setting.key, setting.value]))

  return {
    googleGeminiApiKey: settingsMap.get('GOOGLE_GEMINI_API_KEY') || '',
    geminiEnabled: settingsMap.get('GEMINI_ENABLED') === 'true',
    r2AccountId: settingsMap.get('R2_ACCOUNT_ID') || '',
    r2AccessKeyId: settingsMap.get('R2_ACCESS_KEY_ID') || '',
    r2SecretAccessKey: getSettingValue(records, 'R2_SECRET_ACCESS_KEY'),
    r2BucketName: settingsMap.get('R2_BUCKET_NAME') || '',
    r2PublicUrl: settingsMap.get('R2_PUBLIC_URL') || '',
    r2Enabled: settingsMap.get('R2_ENABLED') === 'true',
  }
}

export function buildApiSettingsUpserts(payload: ApiSettingsPostPayload): SettingsUpsertInput[] {
  const upserts: SettingsUpsertInput[] = []

  if (payload.googleGeminiApiKey !== undefined) {
    upserts.push({
      key: 'GOOGLE_GEMINI_API_KEY',
      value: payload.googleGeminiApiKey?.trim() || null,
      description: 'Google Gemini API Key untuk OCR KTP',
    })
  }

  if (payload.geminiEnabled !== undefined) {
    upserts.push({
      key: 'GEMINI_ENABLED',
      value: payload.geminiEnabled ? 'true' : 'false',
      description: 'Enable Google Gemini API for OCR',
    })
  }

  if (payload.r2AccountId !== undefined) {
    upserts.push({
      key: 'R2_ACCOUNT_ID',
      value: payload.r2AccountId?.trim() || null,
      description: 'Cloudflare Account ID',
    })
  }

  if (payload.r2AccessKeyId !== undefined) {
    upserts.push({
      key: 'R2_ACCESS_KEY_ID',
      value: payload.r2AccessKeyId?.trim() || null,
      description: 'Cloudflare R2 Access Key ID',
    })
  }

  if (payload.r2SecretAccessKey !== undefined) {
    const secretValue = payload.r2SecretAccessKey?.trim() || ''
    upserts.push({
      key: 'R2_SECRET_ACCESS_KEY',
      value: secretValue ? encryptApiKey(secretValue) : null,
      description: 'Cloudflare R2 Secret Access Key',
      encrypted: true,
    })
  }

  if (payload.r2BucketName !== undefined) {
    upserts.push({
      key: 'R2_BUCKET_NAME',
      value: payload.r2BucketName?.trim() || null,
      description: 'Cloudflare R2 Bucket Name',
    })
  }

  if (payload.r2PublicUrl !== undefined) {
    upserts.push({
      key: 'R2_PUBLIC_URL',
      value: payload.r2PublicUrl?.trim() || null,
      description: 'Cloudflare R2 Public URL (custom domain atau R2.dev)',
    })
  }

  if (payload.r2Enabled !== undefined) {
    upserts.push({
      key: 'R2_ENABLED',
      value: payload.r2Enabled ? 'true' : 'false',
      description: 'Enable Cloudflare R2 Storage',
    })
  }

  return upserts
}
