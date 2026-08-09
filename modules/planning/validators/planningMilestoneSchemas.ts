import { z } from "zod";

/**
 * Validation schemas for Planning Milestone bulk update operations
 */

// Update single milestone schema
export const updateMilestoneSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED"]).optional(),
  actualDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(500, "Notes too long").optional().nullable(),
});

export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

// Bulk update milestones schema
export const bulkUpdateMilestonesSchema = z.object({
  milestones: z
    .array(
      z.object({
        id: z.string().uuid("Invalid milestone ID"),
        status: z
          .enum(["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED"])
          .optional(),
        actualDate: z.string().datetime().optional().nullable(),
        notes: z.string().max(500, "Notes too long").optional().nullable(),
      }),
    )
    .min(1, "At least one milestone required"),
});

export type BulkUpdateMilestonesInput = z.infer<
  typeof bulkUpdateMilestonesSchema
>;
