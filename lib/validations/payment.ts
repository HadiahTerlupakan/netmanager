import { z } from 'zod'

export const paymentSchema = z.object({
  invoiceId: z.string().optional(),
  pelangganId: z.string().min(1, 'Pelanggan harus dipilih'),
  amount: z.number().min(1, 'Jumlah pembayaran minimal 1'),
  paymentDate: z.string().min(1, 'Tanggal pembayaran harus diisi').transform((val) => new Date(val)),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'E_WALLET', 'CREDIT_CARD', 'DEBIT_CARD', 'CHECK', 'OTHER']),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export const updatePaymentSchema = paymentSchema.partial().omit({ pelangganId: true })

export type PaymentSchema = z.infer<typeof paymentSchema>
export type UpdatePaymentSchema = z.infer<typeof updatePaymentSchema>