import { z } from "zod";

export const createReconciliationSchema = z.object({
  coaId: z.string().min(1, "coaId wajib diisi"),
  statementDate: z.coerce.date({ error: "statementDate wajib diisi" }),
  statementBalance: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)), {
      message: "statementBalance harus angka valid",
    }),
  bookBalance: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)), {
      message: "bookBalance harus angka valid",
    }),
});

export const uploadCsvSchema = z.object({
  format: z.enum(["BCA", "MANDIRI", "BNI", "GENERIC"]),
});

export const manualMatchSchema = z.object({
  lineId: z.string().min(1),
  journalLineId: z.string().min(1),
});

export type CreateReconciliationInput = z.infer<
  typeof createReconciliationSchema
>;
export type UploadCsvInput = z.infer<typeof uploadCsvSchema>;
export type ManualMatchInput = z.infer<typeof manualMatchSchema>;
