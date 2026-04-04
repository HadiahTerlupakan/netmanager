/**
 * Support Ticket Validation Schemas
 * Zod schemas for support ticket validation
 */

import * as z from 'zod'
import { TicketStatus, TicketCategory, TicketPriority } from '@prisma/client'

/**
 * Query params validation for listing support tickets
 */
export const supportTicketFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(TicketStatus).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  search: z.string().optional(),
  assignedToMe: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
})

export type SupportTicketFilter = z.infer<typeof supportTicketFilterSchema>

/**
 * Request body validation for creating support ticket
 */
export const supportTicketCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority).optional(),
  customerId: z.string().uuid().optional(),
})

export type SupportTicketCreate = z.infer<typeof supportTicketCreateSchema>

/**
 * Request body validation for updating support ticket
 */
export const supportTicketUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  resolution: z.string().optional().nullable(),
})

export type SupportTicketUpdate = z.infer<typeof supportTicketUpdateSchema>
