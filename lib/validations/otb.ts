import { z } from 'zod'

export const otbCreateSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  location: z.string().max(512).optional().nullable(),
  coreCount: z.number().int().positive('Jumlah core harus lebih dari 0'),
  notes: z.string().max(1000).optional().nullable(),
  keteranganJumlahKabelFeeder: z.string().max(500).optional().nullable(),
  latitude: z
    .number()
    .gte(-90, 'Latitude minimal -90')
    .lte(90, 'Latitude maksimal 90')
    .optional()
    .nullable(),
  longitude: z
    .number()
    .gte(-180, 'Longitude minimal -180')
    .lte(180, 'Longitude maksimal 180')
    .optional()
    .nullable(),
  status: z.enum(['AKTIF', 'NONAKTIF', 'MAINTENANCE']).optional().default('AKTIF'),
  cores: z
    .array(
      z.object({
        idx: z.number().int().min(0),
        slotName: z.string().min(1, 'Nama slot wajib'),
        tubeColor: z.string().optional().default(''),
        coreColor: z.string().optional().default(''),
      })
    )
    .optional()
})

export const otbUpdateSchema = otbCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Tidak ada perubahan' }
)


