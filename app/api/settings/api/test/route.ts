import { NextResponse } from 'next/server'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

/**
 * POST /api/settings/api/test
 * Test API Key Google Gemini
 */
export const POST = createHandler({ auth: true, permissions: ['settings:update'] }, async (req) => {
  const body = await req.json()
  const { apiKey } = body

  if (!apiKey || !apiKey.trim()) {
    return ApiErrors.badRequest('API Key tidak boleh kosong')
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
  return apiSuccess({
    success: true,
    valid: true,
    message: 'API Key valid dan dapat digunakan',
  })
})
