import { NextRequest } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { prismaBilling } from '@/lib/prisma-billing'
import { convertAndSaveImage } from '@/lib/utils/image-upload'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

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
                    receiptUrl: receiptUrl
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
