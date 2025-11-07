import { z } from 'zod'

const ioRowSchema = z.object({
  idx: z.number().int().min(0),
  inputUnit: z.string().min(1, 'Input Unit wajib'),
  portUnit: z.string().min(1, 'Port Unit wajib'),
  tubeColor: z.string().min(1, 'Warna tube wajib'),
  coreColor: z.string().min(1, 'Warna core wajib'),
})

export const joinboxCreateSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  location: z.string().max(512).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
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
  inputs: z.array(ioRowSchema).default([]),
  outputs: z.array(ioRowSchema).default([]),
})

export const joinboxUpdateSchema = joinboxCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Tidak ada perubahan' }
)


