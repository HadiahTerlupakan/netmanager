import { TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";
import * as z from "zod";

/** Validate query params untuk daftar support ticket. */
export const supportTicketFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(TicketStatus).optional(),
  category: z.enum(TicketCategory).optional(),
  priority: z.enum(TicketPriority).optional(),
  search: z.string().optional(),
  assignedToMe: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export type SupportTicketFilter = z.infer<typeof supportTicketFilterSchema>;

/** Validate payload untuk membuat support ticket. */
export const supportTicketCreateSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.enum(TicketCategory),
  priority: z.enum(TicketPriority).optional(),
  customerId: z.uuid().optional(),
});

export type SupportTicketCreate = z.infer<typeof supportTicketCreateSchema>;

/** Validate payload untuk mengubah support ticket. */
export const supportTicketUpdateSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(TicketStatus).optional(),
  category: z.enum(TicketCategory).optional(),
  priority: z.enum(TicketPriority).optional(),
  assignedToId: z.uuid().nullable().optional(),
  resolution: z.string().optional().nullable(),
});

export type SupportTicketUpdate = z.infer<typeof supportTicketUpdateSchema>;
