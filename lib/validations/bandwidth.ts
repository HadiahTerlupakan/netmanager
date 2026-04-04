import * as z from 'zod'

// Validasi format MikroTik (contoh: "10M", "10240k", "1G")
const mikrotikFormatRegex = /^\d+(\.\d+)?[KMGTkmgt]?$/

export const bandwidthSchema = z.object({
  name: z.string().min(1, 'Nama bandwidth harus diisi').max(100, 'Nama bandwidth maksimal 100 karakter'),
  // Max Limit (wajib)
  maxLimitDownload: z.string().min(1, 'Max Limit Download harus diisi').regex(mikrotikFormatRegex, 'Format tidak valid (contoh: 10M, 10240k)'),
  maxLimitUpload: z.string().min(1, 'Max Limit Upload harus diisi').regex(mikrotikFormatRegex, 'Format tidak valid (contoh: 10M, 10240k)'),
  // Burst Limit (opsional)
  burstLimitDownload: z.string().regex(mikrotikFormatRegex, 'Format tidak valid (contoh: 15M, 15360k)').optional().or(z.literal('')),
  burstLimitUpload: z.string().regex(mikrotikFormatRegex, 'Format tidak valid (contoh: 15M, 15360k)').optional().or(z.literal('')),
  // Min Limit (opsional)
  minLimitDownload: z.string().regex(mikrotikFormatRegex, 'Format tidak valid (contoh: 5M, 5120k)').optional().or(z.literal('')),
  minLimitUpload: z.string().regex(mikrotikFormatRegex, 'Format tidak valid (contoh: 5M, 5120k)').optional().or(z.literal('')),
  // Burst Threshold (opsional)
  burstThresholdDownload: z.string().regex(mikrotikFormatRegex, 'Format tidak valid (contoh: 12M, 12288k)').optional().or(z.literal('')),
  burstThresholdUpload: z.string().regex(mikrotikFormatRegex, 'Format tidak valid (contoh: 12M, 12288k)').optional().or(z.literal('')),
  // Burst Time (opsional)
  burstTimeDownload: z.number().min(0).optional().nullable(),
  burstTimeUpload: z.number().min(0).optional().nullable(),
  // Priority (opsional, 1-8)
  priority: z.number().min(1).max(8).optional().nullable(),
  // Legacy fields (untuk backward compatibility)
  uploadSpeed: z.number().optional().nullable(),
  downloadSpeed: z.number().optional().nullable(),
  description: z.string().optional(),
  status: z.enum(['AKTIF', 'NONAKTIF', 'MAINTENANCE']).default('AKTIF'),
})

export type BandwidthSchema = z.infer<typeof bandwidthSchema>

