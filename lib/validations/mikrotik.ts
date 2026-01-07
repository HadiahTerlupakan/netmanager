import { z } from 'zod'

export const mikrotikRouterCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama Router wajib diisi'),
  ipAddress: z.string().trim().min(1, 'IP Router wajib diisi'),
  timezone: z.string().trim().optional(),
  apiPort: z.number().int().min(1).max(65535).optional(),
  apiUsername: z.string().trim().min(1, 'Username API wajib diisi'),
  apiPassword: z.string().min(1, 'Password API wajib diisi'),
  authPort: z.number().int().min(1).max(65535).optional(),
  accountingPort: z.number().int().min(1).max(65535).optional(),
  secretRadius: z.string().trim().min(1, 'Secret Radius wajib diisi'),
  isolirUrl: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  siteId: z.string().optional().nullable(),
})

export const mikrotikRouterUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  ipAddress: z.string().trim().min(1).optional(),
  timezone: z.string().trim().optional(),
  apiPort: z.number().int().min(1).max(65535).optional(),
  apiUsername: z.string().trim().min(1).optional(),
  apiPassword: z.string().optional(),
  authPort: z.number().int().min(1).max(65535).optional(),
  accountingPort: z.number().int().min(1).max(65535).optional(),
  secretRadius: z.string().trim().min(1).optional(),
  isolirUrl: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  siteId: z.string().optional().nullable(),
})

