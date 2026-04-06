import { encryptApiKey } from '@/lib/utils/encryption'
import { logger } from '@/lib/logger'
import { WhatsAppService } from '@/modules/notification'
import type { SettingsUpsertInput } from '../repositories/SettingsRepository'
import { getTenantSettingsMap, upsertTenantSettings } from './tenantSettings'
import type { TenantSettingsMap } from './tenantSettings'

export type WhatsAppSettingsPayload = {
  whatsappProvider: string
  whatsappApiKey: string
  whatsappDomain: string
  whatsappDeviceId: string
}

export type WhatsAppSettingsUpdatePayload = Partial<WhatsAppSettingsPayload>

export type WhatsAppTestResult = {
  success: boolean
  message: string
  source: 'provider' | 'system'
}

export const WHATSAPP_SETTINGS_FIELDS = [
  { key: 'WHATSAPP_PROVIDER', defaultValue: 'WABLAS' },
  { key: 'WHATSAPP_API_KEY', defaultValue: '', decryptValue: true },
  { key: 'WABLAS_DOMAIN', defaultValue: '' },
  { key: 'WABLAS_DEVICE_ID', defaultValue: '' },
] as const

function sanitizeString(value?: string): string {
  return value?.trim() ?? ''
}

function mapToPayload(settingsMap: TenantSettingsMap): WhatsAppSettingsPayload {
  return {
    whatsappProvider: (settingsMap['WHATSAPP_PROVIDER'] || 'WABLAS').toString(),
    whatsappApiKey: settingsMap['WHATSAPP_API_KEY'] || '',
    whatsappDomain: settingsMap['WABLAS_DOMAIN'] || '',
    whatsappDeviceId: settingsMap['WABLAS_DEVICE_ID'] || '',
  }
}

function buildUpsertEntries(payload: WhatsAppSettingsUpdatePayload): SettingsUpsertInput[] {
  const entries: SettingsUpsertInput[] = []

  const providerValue = sanitizeString(payload.whatsappProvider)
  if (providerValue) {
    entries.push({
      key: 'WHATSAPP_PROVIDER',
      value: providerValue,
      description: 'WhatsApp configuration: WHATSAPP_PROVIDER',
    })
  }

  const apiKeyValue = sanitizeString(payload.whatsappApiKey)
  if (apiKeyValue) {
    entries.push({
      key: 'WHATSAPP_API_KEY',
      value: encryptApiKey(apiKeyValue),
      encrypted: true,
      description: 'WhatsApp configuration: WHATSAPP_API_KEY',
    })
  }

  const deviceIdValue = sanitizeString(payload.whatsappDeviceId)
  if (deviceIdValue) {
    entries.push({
      key: 'WABLAS_DEVICE_ID',
      value: deviceIdValue,
      description: 'WhatsApp configuration: WABLAS_DEVICE_ID',
    })
  }

  const domainValue = sanitizeString(payload.whatsappDomain)
  if (domainValue) {
    entries.push({
      key: 'WABLAS_DOMAIN',
      value: domainValue,
      description: 'WhatsApp configuration: WABLAS_DOMAIN',
    })
  }

  return entries
}

export async function getWhatsAppSettings(tenantId: string): Promise<WhatsAppSettingsPayload> {
  const settingsMap = await getTenantSettingsMap(tenantId, WHATSAPP_SETTINGS_FIELDS)
  return mapToPayload(settingsMap)
}

export async function updateWhatsAppSettings(
  tenantId: string,
  payload: WhatsAppSettingsUpdatePayload
): Promise<void> {
  const entries = buildUpsertEntries(payload)
  if (!entries.length) {
    return
  }

  await upsertTenantSettings(tenantId, entries)
}

export async function testWhatsAppSettings(phone: string): Promise<WhatsAppTestResult> {
  const whatsappService = new WhatsAppService()

  try {
    const result = await whatsappService.testConnection(phone)
    const message = result.success
      ? 'Pesan percobaan berhasil dikirim'
      : result.error || 'Gagal mengirim pesan percobaan WhatsApp'

    return {
      success: Boolean(result.success),
      message,
      source: 'provider',
    }
  } catch (error) {
    logger.error('[WhatsApp Test] Failed to execute WhatsApp test', error as Error, { phone })
    return {
      success: false,
      message: 'Gagal menjalankan tes WhatsApp',
      source: 'system',
    }
  }
}
