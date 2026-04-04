import * as z from 'zod'

export const workOrderEscalationCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama eskalasi wajib diisi').max(100, 'Nama eskalasi maksimal 100 karakter'),
  description: z.string().trim().optional().or(z.literal('')),
  slaId: z.string().trim().optional().or(z.literal('')),
  workOrderType: z.enum(['INSTALLATION', 'TROUBLESHOOT', 'MAINTENANCE', 'UPGRADE', 'RELOCATION', 'DISCONNECTION', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
  departmentId: z.string().trim().optional().or(z.literal('')),
  triggerCondition: z.string().min(1, 'Kondisi trigger wajib diisi'),
  escalationLevel: z.number().min(1, 'Level eskalasi minimal 1').max(10, 'Level eskalasi maksimal 10').default(1),
  notifyRole: z.string().trim().optional().or(z.literal('')),
  notifyEmployees: z.array(z.string()).default([]),
  notifyDepartments: z.array(z.string()).default([]),
  delayMinutes: z.number().min(0, 'Delay tidak boleh negatif').int('Delay harus berupa bilangan bulat').default(0),
  isActive: z.boolean().default(true),
})

export const workOrderEscalationUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Nama eskalasi wajib diisi').max(100, 'Nama eskalasi maksimal 100 karakter').optional(),
  description: z.string().trim().optional().or(z.literal('').transform((): undefined => undefined)),
  slaId: z.string().trim().optional().or(z.literal('').transform((): undefined => undefined)),
  workOrderType: z.enum(['INSTALLATION', 'TROUBLESHOOT', 'MAINTENANCE', 'UPGRADE', 'RELOCATION', 'DISCONNECTION', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
  departmentId: z.string().trim().optional().or(z.literal('').transform((): undefined => undefined)),
  triggerCondition: z.string().min(1, 'Kondisi trigger wajib diisi').optional(),
  escalationLevel: z.number().min(1, 'Level eskalasi minimal 1').max(10, 'Level eskalasi maksimal 10').optional(),
  notifyRole: z.string().trim().optional().or(z.literal('').transform((): undefined => undefined)),
  notifyEmployees: z.array(z.string()).optional(),
  notifyDepartments: z.array(z.string()).optional(),
  delayMinutes: z.number().min(0, 'Delay tidak boleh negatif').int('Delay harus berupa bilangan bulat').optional(),
  isActive: z.boolean().optional(),
})

export const workOrderEscalationQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val) || 1).default(1),
  limit: z.string().transform(val => parseInt(val) || 10).default(10),
  search: z.string().trim().optional().or(z.literal('')),
  slaId: z.string().trim().optional().or(z.literal('')),
  workOrderType: z.enum(['INSTALLATION', 'TROUBLESHOOT', 'MAINTENANCE', 'UPGRADE', 'RELOCATION', 'DISCONNECTION', 'OTHER']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
  departmentId: z.string().trim().optional().or(z.literal('')),
  escalationLevel: z.string().transform(val => parseInt(val)).optional(),
  isActive: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  sortBy: z.enum(['name', 'slaId', 'workOrderType', 'priority', 'escalationLevel', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type WorkOrderEscalationCreateSchema = z.infer<typeof workOrderEscalationCreateSchema>
export type WorkOrderEscalationUpdateSchema = z.infer<typeof workOrderEscalationUpdateSchema>
export type WorkOrderEscalationQuerySchema = z.infer<typeof workOrderEscalationQuerySchema>