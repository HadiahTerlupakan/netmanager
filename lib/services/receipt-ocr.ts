import { prisma } from '@/lib/prisma'

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
    error?: {
        message?: string;
    };
}

export interface ReceiptOCRResult {
    is_valid_receipt: boolean;
    is_potentially_fake: boolean;
    nominal?: number;
    tanggal?: string;
    nama_pengirim?: string;
    bank_pengirim?: string;
    bank_tujuan?: string;
    catatan_analisis: string;
}

/**
 * Service untuk mendeteksi keaslian dan mengekstrak data dari bukti pembayaran
 * menggunakan Google Gemini API.
 */
export async function analyzeReceiptWithOCR(
    fileBuffer: ArrayBuffer,
    fileType: string
): Promise<ReceiptOCRResult> {
    try {
        // Ambil API Key dari database atau environment variable
        let apiKey = process.env.GOOGLE_GEMINI_API_KEY

        // Cek di database terlebih dahulu
        const settings = await prisma.settings.findFirst({ where: { key: 'GOOGLE_GEMINI_API_KEY' },
        })

        if (settings?.value) {
            apiKey = settings.value
        }

        if (!apiKey) {
            throw new Error('Google Gemini API Key tidak dikonfigurasi')
        }

        // Convert file ke base64
        const buffer = Buffer.from(fileBuffer)
        const base64ImageData = buffer.toString('base64')

        // Tentukan mimeType
        let mimeType = 'image/jpeg'
        if (fileType === 'image/png') {
            mimeType = 'image/png'
        } else if (fileType === 'image/jpeg' || fileType === 'image/jpg') {
            mimeType = 'image/jpeg'
        } else if (fileType === 'application/pdf') {
            mimeType = 'application/pdf'
        }

        // Schema KTP OCR disesuaikan untuk Struk Pembayaran
        const receiptSchema = {
            type: 'OBJECT',
            properties: {
                is_valid_receipt: { type: 'BOOLEAN', description: 'Apakah gambar ini merupakan gambar struk/bukti transfer bank atau E-wallet yang valid? Jika hanya bon belanja toko grosir, foto acak, atau selfie, isi false.' },
                is_potentially_fake: { type: 'BOOLEAN', description: 'Apakah gambar ini memiliki indikasi struk palsu atau hasil editan secara visual? (Misal: font berbeda ukuran/warna, bekas tempelan, pixel kasar di area teks/nominal). PENTING: JANGAN ANGGAP PALSU hanya karena tanggalnya berada di masa depan atau masa lalu, selama visual gambarnya sendiri tampak asli.' },
                nominal: { type: 'NUMBER', description: 'Jumlah nominal transfer yang tertera pada struk. Kembalikan dalam bentuk angka bulat (integer) tanpa titik/koma pemisah ribuan. Contoh: 150000.' },
                tanggal: { type: 'STRING', description: 'Tanggal transaksi yang tertera pada struk. Tanggal dan waktu jika ada.' },
                nama_pengirim: { type: 'STRING', description: 'Nama pengirim (A/n Pengirim) jika tertera.' },
                bank_pengirim: { type: 'STRING', description: 'Nama bank atau metode e-wallet dari pengirim.' },
                bank_tujuan: { type: 'STRING', description: 'Nama bank tujuan atau nama penerima akhir transfer.' },
                catatan_analisis: { type: 'STRING', description: 'Penjelasan singkat mengenai analisis keaslian. Sebutkan alasan kenapa ditandai potentially_fake jika true. Jika asli, beri keterangan bahwa struk tampak wajar.' },
            },
            required: ['is_valid_receipt', 'is_potentially_fake', 'catatan_analisis'],
        }

        // Gunakan model yang sama seperti di KTP OCR
        const models = ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-flash-latest']

        for (const model of models) {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

            const payload = {
                contents: [
                    {
                        parts: [
                            {
                                text: 'Anda adalah asisten verifikator keuangan yang sangat teliti. Analisis gambar bukti pembayaran (struk transfer bank / e-wallet) ini. Ekstrak data nominal, tanggal, dan nama bank. PENTING: Perhatikan dengan saksama indikasi editan/palsu SECARA VISUAL seperti: 1) Ada bekas tempelan kotak menutupi teks asli, 2) Font teks nominal atau nama tidak sesuai dengan font standar bank pada umumnya, 3) Pixel disekitar teks penting terlihat lebih kasar (bekas hapusan/smudge). Isi `is_potentially_fake` menjadi true HANYA JIKA ada indikasi visual ini. JANGAN isi true hanya karena masalah logika tanggal seperti "berada di masa depan".',
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
                    responseSchema: receiptSchema,
                    temperature: 0.1, // Rendah agar analisis faktual dan konsisten
                },
            }

            console.log(`[ReceiptOCR] Trying model: ${model}`)
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                if (model !== models[models.length - 1]) {
                    continue
                }
                throw new Error(`API Error: ${response.statusText}`)
            }

            const text = await response.text()
            if (!text) {
                if (model !== models[models.length - 1]) continue
                throw new Error('Response body is empty')
            }

            const result: GeminiResponse = JSON.parse(text)

            if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
                try {
                    const receiptData = JSON.parse(result.candidates[0].content.parts[0].text) as ReceiptOCRResult
                    console.log(`[ReceiptOCR] Successfully analyzed using model: ${model}`)
                    return receiptData
                } catch (_e) {
                    if (model !== models[models.length - 1]) continue
                    throw new Error('Gagal memparse hasil data OCR')
                }
            } else {
                if (model !== models[models.length - 1]) continue
                throw new Error('Struktur respons API tidak valid.')
            }
        }

        throw new Error('Semua model gagal memproses OCR')

    } catch (error) {
        console.error('[ReceiptOCR] Error:', error)
        // Jika OCR error, kita sebaiknya tidak memblokir upload sama sekali.
        // Return graceful fallback
        return {
            is_valid_receipt: true, // Asumsikan true agar tidak terblokir karena sistem error
            is_potentially_fake: false,
            catatan_analisis: `[Sistem OCR Gagal: ${(error as Error).message}] Pembayaran tidak diverifikasi otomatis.`,
        }
    }
}
