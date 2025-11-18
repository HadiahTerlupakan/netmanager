import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

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
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Ambil dari database
    const googleGeminiKey = await prisma.settings.findUnique({
      where: { key: 'GOOGLE_GEMINI_API_KEY' },
    })

    // Jika ada di database, return value-nya. Jika tidak ada, return empty string (jangan return env untuk keamanan)
    const googleGeminiApiKey = googleGeminiKey?.value || ''

    return NextResponse.json({
      googleGeminiApiKey,
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
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { googleGeminiApiKey } = body

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

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving API settings:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

