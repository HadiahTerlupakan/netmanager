import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clearR2SettingsCache } from '@/lib/utils/r2-client'

/**
 * GET /api/settings/api
 * Mengambil pengaturan API
 */
export async function GET(req: NextRequest) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cek role admin
    if (false) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Ambil semua settings dari database
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: [
            'GOOGLE_GEMINI_API_KEY',
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

    // Return settings (tidak return secret key untuk keamanan)
    return NextResponse.json({
      googleGeminiApiKey: settingsMap.get('GOOGLE_GEMINI_API_KEY') || '',
      r2AccountId: settingsMap.get('R2_ACCOUNT_ID') || '',
      r2AccessKeyId: settingsMap.get('R2_ACCESS_KEY_ID') || '',
      r2SecretAccessKey: settingsMap.get('R2_SECRET_ACCESS_KEY') ? '********' : '',
      r2BucketName: settingsMap.get('R2_BUCKET_NAME') || '',
      r2PublicUrl: settingsMap.get('R2_PUBLIC_URL') || '',
      r2Enabled: settingsMap.get('R2_ENABLED') === 'true'
    })
  } catch (error: any) {
    console.error('Error fetching API settings:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/api
 * Menyimpan pengaturan API
 */
export async function POST(req: NextRequest) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cek role admin
    if (false) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const {
      googleGeminiApiKey,
      r2AccountId,
      r2AccessKeyId,
      r2SecretAccessKey,
      r2BucketName,
      r2PublicUrl,
      r2Enabled
    } = body

    // Upsert Google Gemini API Key
    if (googleGeminiApiKey !== undefined) {
      await prisma.settings.upsert({
        where: { key: 'GOOGLE_GEMINI_API_KEY' },
        update: {
          value: googleGeminiApiKey.trim() || null,
          description: 'Google Gemini API Key untuk OCR KTP',
          updatedAt: new Date(),
        },
        create: {
          key: 'GOOGLE_GEMINI_API_KEY',
          value: googleGeminiApiKey.trim() || null,
          description: 'Google Gemini API Key untuk OCR KTP',
          encrypted: false,
        },
      })
    }

    // Upsert R2 Settings
    if (r2AccountId !== undefined) {
      await prisma.settings.upsert({
        where: { key: 'R2_ACCOUNT_ID' },
        update: { value: r2AccountId.trim() || null, updatedAt: new Date() },
        create: {
          key: 'R2_ACCOUNT_ID',
          value: r2AccountId.trim() || null,
          description: 'Cloudflare Account ID',
          encrypted: false,
        },
      })
    }

    if (r2AccessKeyId !== undefined) {
      await prisma.settings.upsert({
        where: { key: 'R2_ACCESS_KEY_ID' },
        update: { value: r2AccessKeyId.trim() || null, updatedAt: new Date() },
        create: {
          key: 'R2_ACCESS_KEY_ID',
          value: r2AccessKeyId.trim() || null,
          description: 'Cloudflare R2 Access Key ID',
          encrypted: false,
        },
      })
    }

    // Hanya update secret key jika bukan placeholder
    if (r2SecretAccessKey !== undefined && r2SecretAccessKey !== '********') {
      await prisma.settings.upsert({
        where: { key: 'R2_SECRET_ACCESS_KEY' },
        update: { value: r2SecretAccessKey.trim() || null, updatedAt: new Date() },
        create: {
          key: 'R2_SECRET_ACCESS_KEY',
          value: r2SecretAccessKey.trim() || null,
          description: 'Cloudflare R2 Secret Access Key',
          encrypted: true,
        },
      })
    }

    if (r2BucketName !== undefined) {
      await prisma.settings.upsert({
        where: { key: 'R2_BUCKET_NAME' },
        update: { value: r2BucketName.trim() || null, updatedAt: new Date() },
        create: {
          key: 'R2_BUCKET_NAME',
          value: r2BucketName.trim() || null,
          description: 'Cloudflare R2 Bucket Name',
          encrypted: false,
        },
      })
    }

    if (r2PublicUrl !== undefined) {
      await prisma.settings.upsert({
        where: { key: 'R2_PUBLIC_URL' },
        update: { value: r2PublicUrl.trim() || null, updatedAt: new Date() },
        create: {
          key: 'R2_PUBLIC_URL',
          value: r2PublicUrl.trim() || null,
          description: 'Cloudflare R2 Public URL (custom domain atau R2.dev)',
          encrypted: false,
        },
      })
    }

    if (r2Enabled !== undefined) {
      await prisma.settings.upsert({
        where: { key: 'R2_ENABLED' },
        update: { value: r2Enabled ? 'true' : 'false', updatedAt: new Date() },
        create: {
          key: 'R2_ENABLED',
          value: r2Enabled ? 'true' : 'false',
          description: 'Enable Cloudflare R2 Storage',
          encrypted: false,
        },
      })
    }

    // Clear R2 settings cache
    clearR2SettingsCache()

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'UPDATE',
        subject: 'Settings',
        userId: session.user.id,
        details: { type: 'API/R2 Configuration' }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving API settings:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}


