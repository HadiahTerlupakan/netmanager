import { z } from 'zod'

export const profilePPPSchema = z.object({
  name: z.string().min(1, 'Nama profile PPP harus diisi').max(100, 'Nama profile PPP maksimal 100 karakter'),
  localAddress: z.string().min(1, 'Local address harus diisi'),
  remoteAddress: z.string().min(1, 'Remote address (nama IP Pool) harus diisi'),
  ipRange: z.string().optional().or(z.literal('')),
  dnsServer: z.string().optional().or(z.literal('')),
  sessionTimeout: z.number().optional().nullable(),
  idleTimeout: z.number().optional().nullable(),
  poolMode: z.enum(['MIKROTIK', 'RADIUS']).default('MIKROTIK'),
  mikroTikRouterId: z.string().optional().nullable(),
  bandwidthId: z.string().optional().nullable(),
  description: z.string().optional().or(z.literal('')),
  siteId: z.string().optional().nullable(),
  status: z.enum(['AKTIF', 'NONAKTIF', 'MAINTENANCE']).default('AKTIF'),
})

export type ProfilePPPSchema = z.infer<typeof profilePPPSchema>
