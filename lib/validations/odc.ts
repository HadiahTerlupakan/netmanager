import { z } from 'zod'

const odcOutputSchema = z.object({
  idx: z.number().int().min(0),
  slotName: z.string().min(1, 'Nama slot wajib'),
  redaman: z
    .number()
    .optional()
    .nullable(),
  tubeColor: z.string().min(1, 'Tube color wajib'),
  coreColor: z.string().min(1, 'Core color wajib'),
})

export const odcCreateSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  location: z.string().max(512).optional().nullable(),
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
  otbCoreId: z.string().min(1, 'Slot OTB wajib dipilih'),
  outputs: z.array(odcOutputSchema).optional(),
})

export const odcUpdateSchema = odcCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Tidak ada perubahan' }
)


