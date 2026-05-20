import { z } from "zod";

const templateLineSchema = z.object({
  coaId: z.string().min(1),
  side: z.enum(["DEBIT", "CREDIT"]),
  amount: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
    message: "amount harus angka positif",
  }),
  description: z.string().nullable().default(null),
});

export const createRecurringSchema = z.object({
  name: z.string().min(1, "Nama template wajib diisi").max(200),
  description: z.string().nullable().optional(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
  dayOfMonth: z.coerce.number().int().min(1).max(28, "dayOfMonth maksimal 28"),
  startDate: z.coerce.date({ error: "startDate wajib diisi" }),
  endDate: z.coerce.date().nullable().optional(),
  templateLines: z.array(templateLineSchema).min(2, "Minimal 2 baris jurnal"),
});

export const updateRecurringSchema = createRecurringSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;
