import { z } from "zod";

const WORK_ORDER_TYPES = [
  "INSTALLATION",
  "TROUBLESHOOT",
  "MAINTENANCE",
  "UPGRADE",
  "RELOCATION",
  "DISCONNECTION",
  "OTHER",
] as const;

const WORK_ORDER_PRIORITIES = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
  "CRITICAL",
] as const;

/** Schema untuk membuat work order baru */
export const workOrderCreateSchema = z.object({
  type: z.enum(WORK_ORDER_TYPES, {
    message: "Tipe work order tidak valid",
  }),
  title: z.string().trim().min(1, "Judul work order wajib diisi"),
  description: z.string().trim().min(1, "Deskripsi work order wajib diisi"),
  priority: z.enum(WORK_ORDER_PRIORITIES).optional(),
  pelangganId: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  siteId: z.string().trim().optional(),
  scheduledDate: z.string().optional(),
  ticketId: z.string().trim().optional(),
  isInternal: z.boolean().optional(),
});

export type WorkOrderCreateInput = z.infer<typeof workOrderCreateSchema>;
