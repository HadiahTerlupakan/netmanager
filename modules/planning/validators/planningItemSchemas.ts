import { z } from "zod";

/**
 * Validation schemas for Planning Item CRUD operations
 */

// Create planning item schema
export const createPlanningItemSchema = z.object({
  name: z.string().min(1, "Item name required").max(200, "Name too long"),
  description: z
    .string()
    .max(500, "Description too long")
    .optional()
    .nullable(),
  quantity: z.number().int().positive("Quantity must be positive"),
  unit: z.string().min(1, "Unit required").max(50, "Unit too long"),
  estimatedPrice: z
    .number()
    .positive("Price must be positive")
    .optional()
    .nullable(),
  notes: z.string().max(500, "Notes too long").optional().nullable(),
});

export type CreatePlanningItemInput = z.infer<typeof createPlanningItemSchema>;

// Update planning item schema
export const updatePlanningItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  quantity: z.number().int().positive().optional(),
  unit: z.string().min(1).max(50).optional(),
  estimatedPrice: z.number().positive().optional().nullable(),
  actualPrice: z.number().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type UpdatePlanningItemInput = z.infer<typeof updatePlanningItemSchema>;
