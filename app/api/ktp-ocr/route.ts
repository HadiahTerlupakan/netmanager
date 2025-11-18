import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/ktp-ocr
 * Ekstraksi data KTP menggunakan Google Gemini API
 */
export async function POST(req: NextRequest) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ambil API Key dari database atau environment variable
    let apiKey = env.GOOGLE_GEMINI_API_KEY

    // Cek di database terlebih dahulu
    const settings = await prisma.settings.findUnique({
      where: { key: 'GOOGLE_GEMINI_API_KEY' },
    })

    if (settings?.value) {
      apiKey = settings.value
    }

    // Cek API Key
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Gemini API Key tidak dikonfigurasi. Silakan atur di menu Pengaturan > API' },
        { status: 500 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'File tidak ditemukan' },
        { status: 400 }
      )
    }

    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File harus berupa gambar (PNG, JPG, JPEG)' },
        { status: 400 }
      )
    }

    // Convert file ke base64
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64ImageData = buffer.toString('base64')

    // Schema untuk ekstraksi data KTP
    const ktpSchema = {
      type: 'OBJECT',
      properties: {
        nik: { type: 'STRING', description: 'Nomor Induk Kependudukan (16 digit)' },
        nama: { type: 'STRING', description: 'Nama Lengkap' },
        tempat_lahir: { type: 'STRING', description: 'Kota Tempat Lahir' },
        tanggal_lahir: { type: 'STRING', description: 'Tanggal Lahir (DD-MM-YYYY)' },
        jenis_kelamin: { type: 'STRING', description: 'Jenis Kelamin' },
        alamat_jalan: { type: 'STRING', description: 'Nama jalan, kampung, atau dusun dari alamat' },
        rt_rw: { type: 'STRING', description: 'Nomor RT dan RW dari alamat, format: 001/002' },
        kel_desa: { type: 'STRING', description: 'Nama Kelurahan atau Desa dari alamat' },
        kecamatan: { type: 'STRING', description: 'Nama Kecamatan dari alamat' },
        provinsi: { type: 'STRING', description: 'Nama Provinsi dari alamat' },
        agama: { type: 'STRING', description: 'Agama' },
        status_perkawinan: { type: 'STRING', description: 'Status Perkawinan' },
        pekerjaan: { type: 'STRING', description: 'Pekerjaan' },
        kewarganegaraan: { type: 'STRING', description: 'Kewarganegaraan' },
        berlaku_hingga: { type: 'STRING', description: 'Masa Berlaku (SEUMUR HIDUP atau tanggal)' },
        tempat_dikeluarkan: { type: 'STRING', description: 'Kota/Kabupaten tempat KTP dikeluarkan, biasanya di kanan bawah' },
        tanggal_dikeluarkan: { type: 'STRING', description: 'Tanggal KTP dikeluarkan (DD-MM-YYYY), biasanya di kanan bawah' },
      },
    }

    // Panggil Google Gemini API - mengikuti implementasi yang berhasil
    // Coba gemini-2.0-flash dulu, jika gagal akan fallback ke gemini-1.5-flash
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash']
    let lastError: any = null
    
    // Tentukan mimeType - mengikuti implementasi yang berhasil
    // Default ke image/jpeg seperti di referensi HTML
    let mimeType = 'image/jpeg'
    if (file.type === 'image/png') {
      mimeType = 'image/png'
    } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      mimeType = 'image/jpeg'
    }

    for (const model of models) {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

      const payload = {
        contents: [
          {
            parts: [
              {
                text: 'Analisis gambar KTP Indonesia ini dengan saksama. Ekstrak semua informasi secara detail sesuai skema JSON. Sangat PENTING: Kembalikan SEMUA medan (field) dalam skema, walaupun tidak dapat ditemukan pada gambar. Jika sebuah medan tidak ditemukan, kembalikan sebagai string kosong (""). Jangan menghilangkan medan apa pun dari respons JSON. Pecah alamat menjadi alamat_jalan, rt_rw, kel_desa, dan kecamatan. Pastikan format tanggal adalah DD-MM-YYYY. Jika bagian alamat tidak terbaca, gunakan konteks dari tempat_dikeluarkan untuk menyimpulkan informasi yang mungkin.',
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64ImageData,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: ktpSchema,
        },
      }

      console.log(`Trying model: ${model}`)
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let errorBody: any = {}
        let errorMessage = response.statusText
        
        try {
          const text = await response.text()
          if (text) {
            errorBody = JSON.parse(text)
            errorMessage = errorBody.error?.message || errorBody.error || errorMessage
          }
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }
        
        console.error(`API Error Response (${model}):`, {
          status: response.status,
          statusText: response.statusText,
          errorBody,
        })
        
        lastError = {
          model,
          status: response.status,
          message: errorMessage,
          details: errorBody,
        }
        
        // Jika ini bukan model terakhir, coba model berikutnya
        if (model !== models[models.length - 1]) {
          console.log(`Model ${model} failed, trying next model...`)
          continue
        }
        
        // Jika semua model gagal, return error
        return NextResponse.json(
          {
            error: `Error API (${response.status}): ${errorMessage}`,
            details: errorBody,
            triedModels: models,
          },
          { status: response.status }
        )
      }

      // Jika response OK, parse dan return
      let result: any
      try {
        const text = await response.text()
        if (!text) {
          throw new Error('Response body is empty')
        }
        result = JSON.parse(text)
      } catch (e: any) {
        console.error('Failed to parse API response:', e)
        // Jika ini bukan model terakhir, coba model berikutnya
        if (model !== models[models.length - 1]) {
          lastError = { model, message: e.message }
          continue
        }
        return NextResponse.json(
          { error: `Gagal memparse respons API: ${e.message}` },
          { status: 500 }
        )
      }

      console.log(`API Response structure (${model}):`, {
        hasCandidates: !!result.candidates,
        candidatesLength: result.candidates?.length,
        firstCandidate: result.candidates?.[0],
        fullResult: JSON.stringify(result).substring(0, 500),
      })

      if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
        try {
          const ktpData = JSON.parse(result.candidates[0].content.parts[0].text)
          console.log(`Successfully extracted KTP data using model: ${model}`)
          return NextResponse.json({ data: ktpData })
        } catch (e: any) {
          console.error('Failed to parse KTP data:', e)
          console.error('Raw text:', result.candidates[0].content.parts[0].text)
          // Jika ini bukan model terakhir, coba model berikutnya
          if (model !== models[models.length - 1]) {
            lastError = { model, message: `Failed to parse KTP data: ${e.message}` }
            continue
          }
          return NextResponse.json(
            { error: `Gagal memparse data KTP: ${e.message}` },
            { status: 500 }
          )
        }
      } else {
        console.error(`Invalid API response structure (${model}):`, JSON.stringify(result, null, 2))
        // Jika ini bukan model terakhir, coba model berikutnya
        if (model !== models[models.length - 1]) {
          lastError = { 
            model, 
            message: 'Struktur respons API tidak valid atau tidak berisi teks.',
            details: result,
          }
          continue
        }
        return NextResponse.json(
          { 
            error: 'Struktur respons API tidak valid atau tidak berisi teks.',
            details: result,
          },
          { status: 500 }
        )
      }
    }
    
    // Jika semua model gagal
    return NextResponse.json(
      {
        error: 'Semua model gagal memproses KTP',
        lastError,
        triedModels: models,
      },
      { status: 500 }
    )
  } catch (error: any) {
    console.error('Error processing KTP OCR:', error)
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat memproses KTP' },
      { status: 500 }
    )
  }
}

