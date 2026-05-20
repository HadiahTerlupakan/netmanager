import { z } from "zod";

const journalLineSchema = z.object({
  coaId: z.string().min(1, "coaId wajib diisi"),
  side: z.enum(["DEBIT", "CREDIT"]),
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    { message: "amount harus angka positif" },
  ),
  description: z.string().nullable().optional(),
});

export const createManualJournalSchema = z.object({
  entryDate: z.coerce.date({ error: "entryDate wajib diisi" }),
  description: z.string().min(1, "description wajib diisi").max(500),
  lines: z
    .array(journalLineSchema)
    .min(2, "Minimal 2 baris jurnal (1 debit + 1 kredit)"),
});

export const journalListQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  source: z
    .enum([
      "AUTO_INVOICE_PAID",
      "AUTO_INVOICE_CREATED",
      "AUTO_PAYMENT",
      "AUTO_EXPENSE",
      "AUTO_PO_PAID",
      "MANUAL",
      "RECURRING",
      "REVERSAL",
      "OPENING_BALANCE",
      "ADJUSTMENT",
      "CLOSING",
    ])
    .optional(),
  status: z.enum(["DRAFT", "POSTED", "REVERSED"]).optional(),
  coaId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateManualJournalInput = z.infer<
  typeof createManualJournalSchema
>;
export type JournalListQueryInput = z.infer<typeof journalListQuerySchema>;
