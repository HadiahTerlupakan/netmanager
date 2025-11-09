import { z } from 'zod'

export const speedProfileCreateSchema = z.object({
  oltId: z.string().min(1, 'OLT ID harus diisi'),
  profileType: z.enum(['Download', 'Upload'], { required_error: 'Profile Type harus dipilih' }),
  name: z.string().min(1, 'Nama Speed Profile harus diisi'),
  type: z.number().int().min(1).max(5, 'Type harus antara 1-5'),
  bandwidthSir: z.number().int().min(0, 'Bandwidth SIR harus >= 0'),
  burstPir: z.number().int().min(0, 'Burst PIR harus >= 0'),
  fixed: z.number().int().min(0).optional().nullable(),
  assured: z.number().int().min(0).optional().nullable(),
  maximum: z.number().int().min(0).optional().nullable(),
})

export const speedProfileUpdateSchema = z.object({
  profileType: z.enum(['Download', 'Upload']).optional(),
  name: z.string().min(1, 'Nama Speed Profile harus diisi').optional(),
  type: z.number().int().min(1).max(5).optional(),
  bandwidthSir: z.number().int().min(0).optional(),
  burstPir: z.number().int().min(0).optional(),
  fixed: z.number().int().min(0).optional().nullable(),
  assured: z.number().int().min(0).optional().nullable(),
  maximum: z.number().int().min(0).optional().nullable(),
})

