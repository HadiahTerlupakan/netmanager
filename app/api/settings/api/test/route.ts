import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import type { AuthOptions } from 'next-auth'

/**
 * POST /api/settings/api/test
 * Test API Key Google Gemini
 */
export async function POST(req: NextRequest) {
  try {
    // Cek autentikasi
    const session = await getServerSession(authConfig as AuthOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cek role admin
    if (false) {
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

    // Test API dengan request sederhana (gunakan gemini-2.5-flash yang tersedia)
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`

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
      let errorMessage = errorBody.error?.message || 'API Key tidak valid'

      // Jika error 404 (Model not found), coba list models untuk diagnosis helper
      if (response.status === 404) {
        try {
            const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`
            const listResponse = await fetch(listModelsUrl)
            if (listResponse.ok) {
                const listData = await listResponse.json()
                const availableModels = listData.models
                    ?.filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes('generateContent'))
                    .map((m: { name: string }) => m.name.replace('models/', ''))
                    .join(', ')
                
                if (availableModels) {
                    errorMessage += `\n\nModel yang tersedia untuk Key ini: ${availableModels}`
                } else {
                    errorMessage += `\n\nTidak ada model yang tersedia untuk key ini (Mungkin perlu aktifkan Generative Language API).`
                }
            }
        } catch (e: unknown) {
            console.error('Failed to list models:', e)
        }
      }

      return NextResponse.json(
        {
          error: errorMessage,
          valid: false,
        },
        { status: 400 }
      )
    }

    // Jika berhasil connect, tetap cek list models untuk memastikan quota/permission
    return NextResponse.json({
      success: true,
      valid: true,
      message: 'API Key valid dan dapat digunakan',
    })
  } catch (error: unknown) {
    console.error('Error testing API key:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat menguji API Key',
        valid: false,
      },
      { status: 500 }
    )
  }
}

