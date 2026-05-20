import { z } from "zod";

export const closePeriodSchema = z.object({
  periodId: z.string().min(1, "periodId wajib diisi"),
});

export const reopenPeriodSchema = z.object({
  periodId: z.string().min(1, "periodId wajib diisi"),
});

export const reverseJournalSchema = z.object({
  journalId: z.string().min(1, "journalId wajib diisi"),
  reason: z.string().min(1, "Alasan reversal wajib diisi").max(500),
});

export const openingBalanceSchema = z.object({
  entryDate: z.coerce.date({ error: "entryDate wajib diisi" }),
  lines: z
    .array(
      z.object({
        coaId: z.string().min(1, "coaId wajib diisi"),
        side: z.enum(["DEBIT", "CREDIT"]),
        amount: z.string().refine(
          (val) => {
            const num = parseFloat(val);
            return !isNaN(num) && num > 0;
          },
          { message: "amount harus angka positif" },
        ),
      }),
    )
    .min(2, "Minimal 2 baris (1 debit + 1 kredit)"),
});

export type ClosePeriodInput = z.infer<typeof closePeriodSchema>;
export type ReopenPeriodInput = z.infer<typeof reopenPeriodSchema>;
export type ReverseJournalInput = z.infer<typeof reverseJournalSchema>;
export type OpeningBalanceInput = z.infer<typeof openingBalanceSchema>;
