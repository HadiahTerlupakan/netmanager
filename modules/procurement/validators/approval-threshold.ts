import { z } from "zod";
import { APPROVAL_THRESHOLD_SCOPES } from "../domain/entities/ApprovalThreshold";

const baseFields = {
  minAmount: z.coerce.number().min(0),
  maxAmount: z.coerce.number().min(0).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
} as const;

function assertRangeValid(
  data: { minAmount: number; maxAmount?: number | null | undefined },
  ctx: z.RefinementCtx,
) {
  if (
    data.maxAmount !== null &&
    data.maxAmount !== undefined &&
    data.maxAmount < data.minAmount
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxAmount"],
      message: "maxAmount tidak boleh lebih kecil dari minAmount",
    });
  }
}

export const createApprovalThresholdSchema = z
  .object({
    scope: z.enum(APPROVAL_THRESHOLD_SCOPES as readonly [string, ...string[]]),
    roleId: z.string().min(1, "Role wajib dipilih"),
    ...baseFields,
  })
  .superRefine(assertRangeValid);

export const updateApprovalThresholdSchema = z
  .object({
    ...baseFields,
  })
  .superRefine((data, ctx) => {
    if (data.minAmount !== undefined) {
      assertRangeValid(
        { minAmount: data.minAmount, maxAmount: data.maxAmount },
        ctx,
      );
    }
  });

export const approvalThresholdListQuerySchema = z.object({
  scope: z
    .enum(APPROVAL_THRESHOLD_SCOPES as readonly [string, ...string[]])
    .optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  roleId: z.string().optional(),
});

export type CreateApprovalThresholdInput = z.infer<
  typeof createApprovalThresholdSchema
>;
export type UpdateApprovalThresholdInput = z.infer<
  typeof updateApprovalThresholdSchema
>;
export type ApprovalThresholdListQuery = z.infer<
  typeof approvalThresholdListQuerySchema
>;
