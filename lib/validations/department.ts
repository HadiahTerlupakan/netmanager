import { z } from "zod";

/** Schema untuk membuat departemen baru */
export const departmentCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama departemen wajib diisi"),
  description: z.string().trim().optional(),
  jobDescription: z.string().trim().optional(),
  isReminderTarget: z.boolean().optional(),
  showInMobileWO: z.boolean().optional(),
});

/** Schema untuk update departemen (semua field opsional) */
export const departmentUpdateSchema = z.object({
  name: z.string().trim().min(1, "Nama departemen wajib diisi").optional(),
  description: z.string().trim().optional(),
  jobDescription: z.string().trim().optional(),
  isReminderTarget: z.boolean().optional(),
  showInMobileWO: z.boolean().optional(),
});

export type DepartmentCreateInput = z.infer<typeof departmentCreateSchema>;
export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>;
