import { NextRequest } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { prismaBilling } from '@/lib/prisma-billing'
import { convertAndSaveImage } from '@/lib/utils/image-upload'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { analyzeReceiptWithOCR } from '@/lib/services/receipt-ocr'

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) return authResult.response

        const session = authResult.session!
        if (!session) return ApiErrors.unauthorized('Sesi tidak valid')

        // Read form data
        const formData = await request.formData()
        const invoiceId = formData.get('invoiceId') as string
        const file = formData.get('file') as File | null

        if (!invoiceId) {
            return apiError('Parameter invoiceId wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        if (!file || !(file instanceof File)) {
            return apiError('Tidak ada file gambar yang valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        if (!file.type.startsWith('image/')) {
            return apiError('File harus berupa gambar', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        // Cari active pending payment untuk invoice tersebut milik customer ini
        const payment = await prismaBilling.payment.findFirst({
            where: {
                invoiceId: invoiceId,
                pelangganId: session.id,
                gatewayStatus: 'PENDING',
                paymentMethod: 'BANK_TRANSFER'
            }
        })

        if (!payment) {
            console.error(`[upload-receipt] FAIL: No pending BANK_TRANSFER found. invoiceId: ${invoiceId}, pelangganId: ${session.idPelanggan}`)
            return apiError('Pembayaran transfer manual yang pending tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 })
        }

        // Upload The File using convertAndSaveImage ensuring R2 / Local consistency based on env
        try {
            // Lakukan OCR pada struk sebelum menyimpan bukti
            const arrayBuffer = await file.arrayBuffer()
            const ocrResult = await analyzeReceiptWithOCR(arrayBuffer, file.type)

            let aiNotes = payment.notes ? payment.notes + '\n---\n' : ''
            const expectedAmount = Number(payment.amount)

            if (ocrResult.is_potentially_fake) {
                aiNotes += `⚠️ [AI Peringatan] Terindikasi palsu/editan. ${ocrResult.catatan_analisis}`
            } else if (!ocrResult.is_valid_receipt) {
                aiNotes += `⚠️ [AI Peringatan] Bukan gambar struk transfer/E-Wallet yang valid. ${ocrResult.catatan_analisis}`
            } else {
                let warnings = []

                // Cek Kesesuaian Nominal
                if (ocrResult.nominal) {
                    if (ocrResult.nominal !== expectedAmount) {
                        warnings.push(`Nominal di struk (Rp${ocrResult.nominal.toLocaleString('id-ID')}) BEDA dengan tagihan (Rp${expectedAmount.toLocaleString('id-ID')})`)
                    }
                } else {
                    warnings.push(`Nominal tidak terbaca`)
                }

                let statusText = warnings.length > 0
                    ? `⚠️ [AI Peringatan] ${warnings.join(', ')}.`
                    : `✅ [AI Validasi] Nominal sesuai (Rp${expectedAmount.toLocaleString('id-ID')}).`

                aiNotes += `${statusText} ${ocrResult.catatan_analisis}`
            }

            const receiptUrl = await convertAndSaveImage(
                file,
                'public/receipts',
                `receipt_${payment.id}_${Date.now()}`,
                'payment-proofs',
                `pelanggan_${session.id}`
            )

            // Update Payment record
            const updatedPayment = await prismaBilling.payment.update({
                where: { id: payment.id },
                data: {
                    receiptUrl: receiptUrl,
                    notes: aiNotes.trim()
                }
            })

            return apiSuccess({
                receiptUrl: updatedPayment.receiptUrl
            }, { message: 'Bukti pembayaran berhasil diunggah' })
        } catch (uploadError) {
            console.error("Failed to upload image:", uploadError)
            return ApiErrors.internalError('Gagal menyimpan file bukti pembayaran')
        }

    } catch (error) {
        console.error('Error in upload-receipt:', error)
        return ApiErrors.internalError('Terjadi kesalahan pada server')
    }
}
