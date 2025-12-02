import { z } from 'zod'

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').optional().or(z.literal('').transform(() => undefined)),
  email: z.string().trim().min(1).email(),
  password: z.string().min(6),
  role: z.enum(['USER', 'ADMIN', 'FINANCE', 'HR']).default('USER'),
})

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['USER', 'ADMIN', 'FINANCE', 'HR']).optional(),
})


