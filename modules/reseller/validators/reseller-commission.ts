import * as z from "zod";

export const listResellerCommissionSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const createResellerSettlementSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  notes: z.string().trim().optional().nullable(),
});

export const resellerCommissionSummarySchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});

export type ListResellerCommissionSchema = z.infer<
  typeof listResellerCommissionSchema
>;
export type CreateResellerSettlementSchema = z.infer<
  typeof createResellerSettlementSchema
>;
export type ResellerCommissionSummarySchema = z.infer<
  typeof resellerCommissionSummarySchema
>;
