import { z } from 'zod'

export const hargaPaketSchema = z.object({
  name: z.string().min(1, 'Nama paket harus diisi').max(100, 'Nama paket maksimal 100 karakter'),
  bandwidthId: z.string().optional().nullable(), // Bandwidth opsional (rate limit diambil dari Profile PPP)
  profilePPPId: z.string().min(1, 'Profile PPP harus dipilih'),
  harga: z.number().min(0, 'Harga minimal 0'),
  durasi: z.number().min(1, 'Durasi minimal 1 hari').default(30),
  description: z.string().optional(),
  featured: z.boolean().default(false),
  status: z.enum(['AKTIF', 'NONAKTIF', 'MAINTENANCE']).default('AKTIF'),
})

export type HargaPaketSchema = z.infer<typeof hargaPaketSchema>

