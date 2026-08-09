import { z } from "zod";

/**
 * Validation schemas for Planning CRUD, submission, and approval operations
 */

// Coordinates schema
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// Create planning schema
export const createPlanningSchema = z.object({
  type: z.enum(["OSP"]),
  title: z.string().min(1, "Title required").max(200, "Title too long"),
  description: z.string().optional().nullable(),
  area: z.string().min(1, "Area required").max(200, "Area too long"),
  coordinates: coordinatesSchema.optional().nullable(),
  estimatedUnits: z.number().int().positive("Estimated units must be positive"),
  estimatedBudget: z
    .number()
    .positive("Budget must be positive")
    .optional()
    .nullable(),
  startDate: z.string().datetime().optional().nullable(),
  targetCompletionDate: z.string().datetime().optional().nullable(),
});

export type CreatePlanningInput = z.infer<typeof createPlanningSchema>;

// Update planning schema
export const updatePlanningSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  area: z.string().min(1).max(200).optional(),
  coordinates: coordinatesSchema.optional().nullable(),
  estimatedUnits: z.number().int().positive().optional(),
  estimatedBudget: z.number().positive().optional().nullable(),
  actualBudget: z.number().positive().optional().nullable(),
  progressPercentage: z.number().min(0).max(100).optional(),
  startDate: z.string().datetime().optional().nullable(),
  targetCompletionDate: z.string().datetime().optional().nullable(),
});

export type UpdatePlanningInput = z.infer<typeof updatePlanningSchema>;

// List/filter planning schema
export const listPlanningSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum([
      "BACKLOG",
      "PENDING_APPROVAL",
      "APPROVED_LEVEL1",
      "APPROVED",
      "IN_PROGRESS",
      "COMPLETED",
      "REJECTED",
      "CANCELLED",
    ])
    .optional(),
  search: z.string().optional(),
});

export type ListPlanningInput = z.infer<typeof listPlanningSchema>;

// Submit for approval schema
export const submitPlanningSchema = z.object({
  // No additional fields needed - planningId comes from route params
});

export type SubmitPlanningInput = z.infer<typeof submitPlanningSchema>;

// Approve planning schema
export const approvePlanningSchema = z.object({
  approvalNotes: z.string().max(500, "Notes too long").optional().nullable(),
});

export type ApprovePlanningInput = z.infer<typeof approvePlanningSchema>;

// Reject planning schema
export const rejectPlanningSchema = z.object({
  approvalNotes: z
    .string()
    .min(1, "Rejection reason required")
    .max(500, "Notes too long"),
});

export type RejectPlanningInput = z.infer<typeof rejectPlanningSchema>;
