import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

/**
 * POST /api/settings/api/test
 * Test API Key Google Gemini
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
    const { apiKey } = body

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        { error: 'API Key tidak boleh kosong' },
        { status: 400 }
      )
    }

    // Test API dengan request sederhana
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`

    const testPayload = {
      contents: [
        {
          parts: [
            {
              text: 'Test',
            },
          ],
        },
      ],
    }

    const response = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    })

    if (!response.ok) {
      const errorBody = await response.json()
      return NextResponse.json(
        {
          error: errorBody.error?.message || 'API Key tidak valid',
          valid: false,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      valid: true,
      message: 'API Key valid dan dapat digunakan',
    })
  } catch (error: any) {
    console.error('Error testing API key:', error)
    return NextResponse.json(
      {
        error: error.message || 'Terjadi kesalahan saat menguji API Key',
        valid: false,
      },
      { status: 500 }
    )
  }
}

