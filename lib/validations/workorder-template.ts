import { z } from 'zod'

export const workOrderTemplateCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama template wajib diisi').max(100, 'Nama template maksimal 100 karakter'),
  description: z.string().trim().optional().or(z.literal('')),
  type: z.enum(['INSTALLATION', 'TROUBLESHOOT', 'MAINTENANCE', 'UPGRADE', 'RELOCATION', 'DISCONNECTION', 'OTHER']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']).default('NORMAL'),
  departmentId: z.string().trim().optional().or(z.literal('')),
  estimatedHours: z.number().min(0, 'Estimasi jam tidak boleh negatif').optional().nullable(),
  estimatedCost: z.number().min(0, 'Estimasi biaya tidak boleh negatif').optional().nullable(),
  requiredMaterials: z.any().optional(),
  tasks: z.any().optional(),
  checklist: z.any().optional(),
  isActive: z.boolean().default(true),
})

export const workOrderTemplateUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Nama template wajib diisi').max(100, 'Nama template maksimal 100 karakter').optional(),
  description: z.string().trim().optional().or(z.literal('').transform((): undefined => undefined)),
  type: z.enum(['INSTALLATION', 'TROUBLESHOOT', 'MAINTENANCE', 'UPGRADE', 'RELOCATION', 'DISCONNECTION', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
  departmentId: z.string().trim().optional().or(z.literal('').transform((): undefined => undefined)),
  estimatedHours: z.number().min(0, 'Estimasi jam tidak boleh negatif').optional().nullable(),
  estimatedCost: z.number().min(0, 'Estimasi biaya tidak boleh negatif').optional().nullable(),
  requiredMaterials: z.any().optional(),
  tasks: z.any().optional(),
  checklist: z.any().optional(),
  isActive: z.boolean().optional(),
})

export const workOrderTemplateQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val) || 1).default(1),
  limit: z.string().transform(val => parseInt(val) || 10).default(10),
  search: z.string().trim().optional().or(z.literal('')),
  type: z.enum(['INSTALLATION', 'TROUBLESHOOT', 'MAINTENANCE', 'UPGRADE', 'RELOCATION', 'DISCONNECTION', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
  departmentId: z.string().trim().optional().or(z.literal('')),
  isActive: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  sortBy: z.enum(['name', 'type', 'priority', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type WorkOrderTemplateCreateSchema = z.infer<typeof workOrderTemplateCreateSchema>
export type WorkOrderTemplateUpdateSchema = z.infer<typeof workOrderTemplateUpdateSchema>
export type WorkOrderTemplateQuerySchema = z.infer<typeof workOrderTemplateQuerySchema>