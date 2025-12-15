import { z } from 'zod'

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').optional().or(z.literal('').transform(() => undefined)),
  email: z.string().trim().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  phone: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  departmentId: z.string().optional().or(z.literal('').transform(() => undefined)),
  siteId: z.string().optional().or(z.literal('').transform(() => undefined)),
  isActive: z.boolean().optional().default(true),
})

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  password: z.string().min(6, 'Password minimal 6 karakter').optional(),
  phone: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  departmentId: z.string().optional().or(z.literal('').transform(() => undefined)),
  siteId: z.string().optional().or(z.literal('').transform(() => undefined)),
  isActive: z.boolean().optional(),
})


