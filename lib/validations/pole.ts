import { z } from 'zod'

export const poleCreateSchema = z.object({
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
  cableSlack: z.boolean().optional(),
})

export const poleUpdateSchema = poleCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Tidak ada perubahan' }
)


