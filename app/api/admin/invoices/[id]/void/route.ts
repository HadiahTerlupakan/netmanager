import { createHandler, apiSuccess } from '@/lib/api'
import { VoidInvoiceService } from '@/modules/finance'
import * as z from 'zod'

/**
 * Validasi body request
 */
const voidSchema = z.object({
    reason: z.string().min(1, 'Alasan pembatalan harus diisi')
})

/**
 * POST /api/admin/invoices/[id]/void
 * 
 * Endpoint untuk membatalkan tagihan yang sudah dibayar.
 * Melakukan refund status pada payment dan rollback jatuhTempo pelanggan.
 */
export const POST = createHandler({
    auth: true,
    schema: voidSchema,
    permissions: ['finance:void-invoice']
}, async (req, ctx) => {
    // ctx.params is already awaited and resolved by createHandler in lib/api/handler.ts
    const { id } = ctx.params
    const { reason } = ctx.validated

    const result = await VoidInvoiceService.voidInvoice(
        id,
        reason,
        ctx.session!.user.id
    )

    return apiSuccess(result.data, { message: 'Tagihan berhasil dibatalkan dan status pembayaran telah di-refund' })
})
