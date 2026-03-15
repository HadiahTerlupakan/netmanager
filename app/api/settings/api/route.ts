import { randomUUID } from 'crypto'
import { createHandler, apiSuccess } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { clearR2SettingsCache } from '@/lib/utils/r2-client'
import { logActivitySafe } from '@/lib/logger'

/**
 * GET /api/settings/api
 * Mengambil pengaturan API
 */
export const GET = createHandler({ auth: true }, async () => {
  // Ambil semua settings dari database
  const settings = await prisma.settings.findMany({
    where: {
      key: {
        in: [
          'GOOGLE_GEMINI_API_KEY',
          'GEMINI_ENABLED',
          'R2_ACCOUNT_ID',
          'R2_ACCESS_KEY_ID',
          'R2_SECRET_ACCESS_KEY',
          'R2_BUCKET_NAME',
          'R2_PUBLIC_URL',
          'R2_ENABLED'
        ]
      }
    }
  })

  const settingsMap = new Map(settings.map(s => [s.key, s.value]))

  // Return settings
  return apiSuccess({
    googleGeminiApiKey: settingsMap.get('GOOGLE_GEMINI_API_KEY') || '',
    geminiEnabled: settingsMap.get('GEMINI_ENABLED') === 'true',
    r2AccountId: settingsMap.get('R2_ACCOUNT_ID') || '',
    r2AccessKeyId: settingsMap.get('R2_ACCESS_KEY_ID') || '',
    r2SecretAccessKey: settingsMap.get('R2_SECRET_ACCESS_KEY') || '',
    r2BucketName: settingsMap.get('R2_BUCKET_NAME') || '',
    r2PublicUrl: settingsMap.get('R2_PUBLIC_URL') || '',
    r2Enabled: settingsMap.get('R2_ENABLED') === 'true'
  })
})

/**
 * POST /api/settings/api
 * Menyimpan pengaturan API
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const body = await req.json()
  console.log('--- SETTINGS API POST BODY ---', body)
  const {
    googleGeminiApiKey,
    geminiEnabled,
    r2AccountId,
    r2AccessKeyId,
    r2SecretAccessKey,
    r2BucketName,
    r2PublicUrl,
    r2Enabled
  } = body

  // Upsert Google Gemini API Key
  if (googleGeminiApiKey !== undefined) {
    {
    const existing = await prisma.settings.findFirst({ where: { key: 'GOOGLE_GEMINI_API_KEY' } })
    if (existing) {
      await prisma.settings.update({ where: { id: existing.id }, data: {value: googleGeminiApiKey.trim() || null,
        description: 'Google Gemini API Key untuk OCR KTP',
        updatedAt: new Date(),} })
    } else {
      await prisma.settings.create({ data: {id: randomUUID(),
        key: 'GOOGLE_GEMINI_API_KEY',
        value: googleGeminiApiKey.trim() || null,
        description: 'Google Gemini API Key untuk OCR KTP',
        encrypted: false,
        updatedAt: new Date()} })
    }
  }
  }

  // Upsert Gemini Enabled
  if (geminiEnabled !== undefined) {
    {
    const existing = await prisma.settings.findFirst({ where: { key: 'GEMINI_ENABLED' } })
    if (existing) {
      await prisma.settings.update({ where: { id: existing.id }, data: {value: geminiEnabled ? 'true' : 'false', updatedAt: new Date()} })
    } else {
      await prisma.settings.create({ data: {id: randomUUID(),
        key: 'GEMINI_ENABLED',
        value: geminiEnabled ? 'true' : 'false',
        description: 'Enable Google Gemini API for OCR',
        encrypted: false,
        updatedAt: new Date()} })
    }
  }
  }

  // Upsert R2 Settings
  if (r2AccountId !== undefined) {
    {
    const existing = await prisma.settings.findFirst({ where: { key: 'R2_ACCOUNT_ID' } })
    if (existing) {
      await prisma.settings.update({ where: { id: existing.id }, data: {value: r2AccountId.trim() || null, updatedAt: new Date()} })
    } else {
      await prisma.settings.create({ data: {id: randomUUID(),
        key: 'R2_ACCOUNT_ID',
        value: r2AccountId.trim() || null,
        description: 'Cloudflare Account ID',
        encrypted: false,
        updatedAt: new Date()} })
    }
  }
  }

  if (r2AccessKeyId !== undefined) {
    {
    const existing = await prisma.settings.findFirst({ where: { key: 'R2_ACCESS_KEY_ID' } })
    if (existing) {
      await prisma.settings.update({ where: { id: existing.id }, data: {value: r2AccessKeyId.trim() || null, updatedAt: new Date()} })
    } else {
      await prisma.settings.create({ data: {id: randomUUID(),
        key: 'R2_ACCESS_KEY_ID',
        value: r2AccessKeyId.trim() || null,
        description: 'Cloudflare R2 Access Key ID',
        encrypted: false,
        updatedAt: new Date()} })
    }
  }
  }

  // Upsert secret key
  if (r2SecretAccessKey !== undefined) {
    {
    const existing = await prisma.settings.findFirst({ where: { key: 'R2_SECRET_ACCESS_KEY' } })
    if (existing) {
      await prisma.settings.update({ where: { id: existing.id }, data: {value: r2SecretAccessKey.trim() || null, updatedAt: new Date()} })
    } else {
      await prisma.settings.create({ data: {id: randomUUID(),
        key: 'R2_SECRET_ACCESS_KEY',
        value: r2SecretAccessKey.trim() || null,
        description: 'Cloudflare R2 Secret Access Key',
        encrypted: true,
        updatedAt: new Date()} })
    }
  }
  }

  if (r2BucketName !== undefined) {
    {
    const existing = await prisma.settings.findFirst({ where: { key: 'R2_BUCKET_NAME' } })
    if (existing) {
      await prisma.settings.update({ where: { id: existing.id }, data: {value: r2BucketName.trim() || null, updatedAt: new Date()} })
    } else {
      await prisma.settings.create({ data: {id: randomUUID(),
        key: 'R2_BUCKET_NAME',
        value: r2BucketName.trim() || null,
        description: 'Cloudflare R2 Bucket Name',
        encrypted: false,
        updatedAt: new Date()} })
    }
  }
  }

  if (r2PublicUrl !== undefined) {
    {
    const existing = await prisma.settings.findFirst({ where: { key: 'R2_PUBLIC_URL' } })
    if (existing) {
      await prisma.settings.update({ where: { id: existing.id }, data: {value: r2PublicUrl.trim() || null, updatedAt: new Date()} })
    } else {
      await prisma.settings.create({ data: {id: randomUUID(),
        key: 'R2_PUBLIC_URL',
        value: r2PublicUrl.trim() || null,
        description: 'Cloudflare R2 Public URL (custom domain atau R2.dev)',
        encrypted: false,
        updatedAt: new Date()} })
    }
  }
  }

  if (r2Enabled !== undefined) {
    {
    const existing = await prisma.settings.findFirst({ where: { key: 'R2_ENABLED' } })
    if (existing) {
      await prisma.settings.update({ where: { id: existing.id }, data: {value: r2Enabled ? 'true' : 'false', updatedAt: new Date()} })
    } else {
      await prisma.settings.create({ data: {id: randomUUID(),
        key: 'R2_ENABLED',
        value: r2Enabled ? 'true' : 'false',
        description: 'Enable Cloudflare R2 Storage',
        encrypted: false,
        updatedAt: new Date()} })
    }
  }
  }

  // Clear R2 settings cache
  clearR2SettingsCache()

  // System Log
  // ctx.session is guaranteed to exist because auth: true
  if (ctx.session?.user?.id) {
    logActivitySafe({
      action: 'UPDATE',
      subject: 'Settings',
      userId: ctx.session.user.id,
      details: { type: 'API/R2 Configuration' }
    })
  }

  return apiSuccess({ success: true })
})
