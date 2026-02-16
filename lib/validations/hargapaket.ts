import { z } from 'zod'

export const hargaPaketSchema = z.object({
  name: z.string().min(1, 'Nama paket harus diisi').max(100, 'Nama paket maksimal 100 karakter'),
  bandwidthId: z.string().optional().nullable(), // Bandwidth opsional (rate limit diambil dari Profile PPP)
  profilePPPId: z.string().min(1, 'Profile PPP harus dipilih'),
  siteId: z.string().optional().nullable(),
  harga: z.number().min(0, 'Harga minimal 0'),
  durasi: z.number().min(1, 'Durasi minimal 1').default(30),
  durasiUnit: z.enum(['JAM', 'HARI', 'BULAN', 'TAHUN']).default('HARI'),
  usePPN: z.boolean().default(false),
  ppnPercentage: z.number().min(0, 'Persentase PPN minimal 0').max(100, 'Persentase PPN maksimal 100').optional().nullable(),
  useDiscount: z.boolean().default(false),
  discountType: z.enum(['FIXED', 'PERCENT']).optional().nullable(),
  discountValue: z.number().min(0, 'Nilai diskon minimal 0').optional().nullable(),
  discountDuration: z.number().min(1, 'Durasi diskon minimal 1').optional().nullable(),
  discountDurationUnit: z.enum(['JAM', 'HARI', 'BULAN', 'TAHUN']).optional().nullable(),
  description: z.string().optional(),
  featured: z.boolean().default(false),
  status: z.enum(['AKTIF', 'NONAKTIF', 'MAINTENANCE']).default('AKTIF'),
}).refine((data) => {
  // Jika usePPN = true, ppnPercentage harus diisi
  if (data.usePPN && (!data.ppnPercentage || data.ppnPercentage <= 0)) {
    return false
  }
  return true
}, {
  message: 'Persentase PPN harus diisi jika menggunakan PPN',
  path: ['ppnPercentage'],
}).refine((data) => {
  // Jika useDiscount = true, discountType dan discountValue harus diisi
  if (data.useDiscount) {
    if (!data.discountType) {
      return false
    }
    if (!data.discountValue || data.discountValue <= 0) {
      return false
    }
    // Jika PERCENT, maksimal 100%
    if (data.discountType === 'PERCENT' && data.discountValue > 100) {
      return false
    }
  }
  return true
}, {
  message: 'Jenis diskon dan nilai diskon harus diisi jika menggunakan diskon',
  path: ['discountValue'],
}).refine((data) => {
  // Jika useDiscount = true, discountDuration dan discountDurationUnit harus diisi
  if (data.useDiscount) {
    if (!data.discountDuration || data.discountDuration <= 0) {
      return false
    }
    if (!data.discountDurationUnit) {
      return false
    }
  }
  return true
}, {
  message: 'Durasi diskon dan unit durasi harus diisi jika menggunakan diskon',
  path: ['discountDuration'],
})

export type HargaPaketSchema = z.infer<typeof hargaPaketSchema>

