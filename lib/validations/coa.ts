import { z } from "zod";

export const createCoaSchema = z.object({
  code: z.string().min(1, "Kode akun wajib diisi"),
  name: z.string().min(1, "Nama akun wajib diisi"),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  subType: z.string().optional(),
  normalBalance: z.enum(["DEBIT", "CREDIT"]),
  parentId: z.string().optional().nullable(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  // New fields
  level: z.number().int().min(1).max(4).default(1),
  isHeader: z.boolean().default(false),
  allowPosting: z.boolean().default(true),
}).refine((data) => {
  // If it's a header, it cannot allow posting
  if (data.isHeader && data.allowPosting) {
    return false;
  }
  return true;
}, {
  message: "Akun Header tidak boleh digunakan untuk transaksi (posting)",
  path: ["allowPosting"],
});

export const updateCoaSchema = createCoaSchema.partial();
export type CreateCoaInput = z.infer<typeof createCoaSchema>;
export type UpdateCoaInput = z.infer<typeof updateCoaSchema>;
