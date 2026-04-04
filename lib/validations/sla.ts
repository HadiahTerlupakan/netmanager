import * as z from 'zod'

export const slaCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama SLA wajib diisi').max(100, 'Nama SLA maksimal 100 karakter'),
  description: z.string().trim().optional().or(z.literal('')),
  workOrderType: z.enum(['INSTALLATION', 'TROUBLESHOOT', 'MAINTENANCE', 'UPGRADE', 'RELOCATION', 'DISCONNECTION', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
  departmentId: z.string().trim().optional().or(z.literal('')),
  responseTime: z.number().min(0, 'Waktu respons tidak boleh negatif').int('Waktu respons harus berupa bilangan bulat'),
  resolutionTime: z.number().min(0, 'Waktu resolusi tidak boleh negatif').int('Waktu resolusi harus berupa bilangan bulat'),
  businessHoursOnly: z.boolean().default(true),
  isActive: z.boolean().default(true),
})

export const slaUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Nama SLA wajib diisi').max(100, 'Nama SLA maksimal 100 karakter').optional(),
  description: z.string().trim().optional().or(z.literal('').transform((): undefined => undefined)),
  workOrderType: z.enum(['INSTALLATION', 'TROUBLESHOOT', 'MAINTENANCE', 'UPGRADE', 'RELOCATION', 'DISCONNECTION', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
  departmentId: z.string().trim().optional().or(z.literal('').transform((): undefined => undefined)),
  responseTime: z.number().min(0, 'Waktu respons tidak boleh negatif').int('Waktu respons harus berupa bilangan bulat').optional(),
  resolutionTime: z.number().min(0, 'Waktu resolusi tidak boleh negatif').int('Waktu resolusi harus berupa bilangan bulat').optional(),
  businessHoursOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const slaQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val) || 1).default(1),
  limit: z.string().transform(val => parseInt(val) || 10).default(10),
  search: z.string().trim().optional().or(z.literal('')),
  workOrderType: z.enum(['INSTALLATION', 'TROUBLESHOOT', 'MAINTENANCE', 'UPGRADE', 'RELOCATION', 'DISCONNECTION', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
  departmentId: z.string().trim().optional().or(z.literal('')),
  isActive: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  sortBy: z.enum(['name', 'workOrderType', 'priority', 'responseTime', 'resolutionTime', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type SLACreateSchema = z.infer<typeof slaCreateSchema>
export type SLAUpdateSchema = z.infer<typeof slaUpdateSchema>
export type SLAQuerySchema = z.infer<typeof slaQuerySchema>