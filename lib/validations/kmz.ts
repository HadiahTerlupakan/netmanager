import { z } from 'zod'

export const kmzCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi'),
  description: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  lineColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Format warna harus hex (contoh: #3388ff)').optional().default('#3388ff'),
  status: z.enum(['AKTIF', 'NONAKTIF', 'MAINTENANCE']).optional().default('AKTIF'),
})

export const kmzUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').optional(),
  description: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  lineColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Format warna harus hex (contoh: #3388ff)').optional(),
  isActive: z.boolean().optional(),
  status: z.enum(['AKTIF', 'NONAKTIF', 'MAINTENANCE']).optional(),
})

