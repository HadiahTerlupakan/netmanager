import { z } from 'zod'

export const profilePPPSchema = z.object({
  name: z.string().min(1, 'Nama profile PPP harus diisi').max(100, 'Nama profile PPP maksimal 100 karakter'),
  localAddress: z.string().min(1, 'Local address harus diisi'),
  remoteAddress: z.string().min(1, 'Remote address (nama IP Pool) harus diisi'),
  ipRange: z.string().optional().or(z.literal('')), // Range IP untuk pool (contoh: "192.168.1.100-192.168.1.200")
  dnsServer: z.string().optional().or(z.literal('')),
  sessionTimeout: z.number().optional().nullable(),
  idleTimeout: z.number().optional().nullable(),
  // Rate limit diambil dari Bandwidth yang terkait melalui HargaPaket atau bandwidthId langsung
  mikroTikRouterId: z.string().optional().nullable(),
  bandwidthId: z.string().optional().nullable(), // Bandwidth untuk rate limit (opsional, prioritas lebih tinggi dari HargaPaket)
  description: z.string().optional().or(z.literal('')),
  status: z.enum(['AKTIF', 'NONAKTIF', 'MAINTENANCE']).default('AKTIF'),
})

export type ProfilePPPSchema = z.infer<typeof profilePPPSchema>

