/**
 * Lembur (Overtime) Validation Schemas
 * Zod schemas for overtime request validation
 */

import * as z from 'zod'

/**
 * Overtime Status enum values
 */
export const OvertimeStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const

export type OvertimeStatusType = keyof typeof OvertimeStatus

/**
 * Query params validation for listing overtime requests
 */
export const lemburFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  siteId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.enum([
    OvertimeStatus.PENDING,
    OvertimeStatus.APPROVED,
    OvertimeStatus.REJECTED,
    OvertimeStatus.IN_PROGRESS,
    OvertimeStatus.COMPLETED,
  ]).optional(),
  holidayType: z.enum([
    'REGULAR',
    'NATIONAL',
    'COLLECTIVE',
    'OFFDAY',
    'ALL_HOLIDAY'
  ]).optional(),
})

export type LemburFilter = z.infer<typeof lemburFilterSchema>

/**
 * Request body validation for creating overtime
 */
export const lemburCreateSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  reason: z.string().min(10).max(500),
})

export type LemburCreate = z.infer<typeof lemburCreateSchema>

/**
 * Request body validation for updating overtime
 */
export const lemburUpdateSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  reason: z.string().min(10).max(500).optional(),
})

export type LemburUpdate = z.infer<typeof lemburUpdateSchema>

/**
 * Overtime action schema (approve/reject)
 */
export const lemburActionSchema = z.object({
  action: z.enum(['approve', 'reject']).optional(),
  reason: z.string().max(500).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
})

export type LemburAction = z.infer<typeof lemburActionSchema>
