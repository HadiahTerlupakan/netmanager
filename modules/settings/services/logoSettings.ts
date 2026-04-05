import path from 'path'
import { access, unlink } from 'fs/promises'
import { convertAndSaveImage, isImageFile } from '@/lib/utils/image-upload'
import { SettingsRepository } from '../repositories/SettingsRepository'

export type LogoType = 'invoice' | 'aplikasi'

export type LogoSettingsPayload = {
  logoInvoice: string | null
  logoAplikasi: string | null
}

const LOGO_SETTINGS_KEYS = ['LOGO_INVOICE', 'LOGO_APLIKASI'] as const

function getSettingKey(type: LogoType): (typeof LOGO_SETTINGS_KEYS)[number] {
  return type === 'invoice' ? 'LOGO_INVOICE' : 'LOGO_APLIKASI'
}

function getSettingDescription(type: LogoType): string {
  return type === 'invoice' ? 'Logo untuk invoice' : 'Logo utama aplikasi'
}

function normalizePublicPath(filePath: string): string {
  return filePath.startsWith('/') ? filePath : `/${filePath}`
}

function resolvePublicFilePath(publicPath: string): string {
  return path.join(process.cwd(), 'public', publicPath.replace(/^\/+/, ''))
}

async function safeDeletePublicFile(publicPath: string): Promise<void> {
  try {
    await unlink(resolvePublicFilePath(publicPath))
  } catch (error) {
    const errorCode = error instanceof Error && 'code' in error ? error.code : undefined
    if (errorCode !== 'ENOENT') {
      console.warn('[logoSettings] Failed to delete logo file:', error)
    }
  }
}

export async function getLogoSettings(): Promise<LogoSettingsPayload> {
  const records = await SettingsRepository.findManyByKeys(LOGO_SETTINGS_KEYS)
  const settingsMap = new Map(records.map((record) => [record.key, record.value]))

  return {
    logoInvoice: settingsMap.get('LOGO_INVOICE') || null,
    logoAplikasi: settingsMap.get('LOGO_APLIKASI') || null,
  }
}

export async function uploadLogo(type: LogoType, file: File): Promise<string> {
  if (!isImageFile(file)) {
    throw new Error('File harus berupa gambar (PNG, JPG, JPEG)')
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file maksimal 5MB')
  }

  const settingKey = getSettingKey(type)
  const oldSetting = await SettingsRepository.findManyByKeys([settingKey])
  const oldValue = oldSetting[0]?.value ?? null

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
  const fileName = type === 'invoice' ? 'logo-invoice' : 'logo-aplikasi'
  const savedPath = await convertAndSaveImage(file, uploadDir, fileName)
  const normalizedPath = normalizePublicPath(savedPath)

  await access(resolvePublicFilePath(normalizedPath))

  await SettingsRepository.upsertMany([
    {
      key: settingKey,
      value: normalizedPath,
      description: getSettingDescription(type),
      encrypted: false,
    },
  ])

  if (oldValue && oldValue !== normalizedPath) {
    await safeDeletePublicFile(oldValue)
  }

  return normalizedPath
}

export async function deleteLogo(type: LogoType): Promise<void> {
  const settingKey = getSettingKey(type)
  const oldSetting = await SettingsRepository.findManyByKeys([settingKey])
  const oldValue = oldSetting[0]?.value ?? null

  await SettingsRepository.deleteManyByKeys([settingKey])

  if (oldValue) {
    await safeDeletePublicFile(oldValue)
  }
}
