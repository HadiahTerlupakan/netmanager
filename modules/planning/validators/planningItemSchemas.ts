import { z } from "zod";

/**
 * Validation schemas for Planning Item CRUD operations
 */

/**
 * Kuantitas material BOQ.
 *
 * Bukan integer: kolomnya `Float` di Prisma dan satuannya bebas teks
 * ("meter", "km", "roll"), jadi 12,5 meter kabel fiber adalah masukan yang
 * wajar. Pembatasan `.int()` sebelumnya menolaknya di API meski database,
 * entity, dan mapper semuanya menerimanya.
 */
const quantitySchema = z.number().positive("Quantity must be positive");

/**
 * Harga satuan — nol adalah nilai sah, bukan kesalahan input.
 *
 * Material yang berasal dari stok, hibah, atau ditanggung pihak ketiga
 * berharga nol. `.positive()` menolaknya dan memaksa operator mengarang angka.
 * Sejalan dengan `actualBudget` di `planningSchemas.ts` yang sudah dikoreksi.
 */
const priceSchema = z.number().nonnegative("Price cannot be negative");

// Create planning item schema
export const createPlanningItemSchema = z.object({
  name: z.string().min(1, "Item name required").max(200, "Name too long"),
  description: z
    .string()
    .max(500, "Description too long")
    .optional()
    .nullable(),
  quantity: quantitySchema,
  unit: z.string().min(1, "Unit required").max(50, "Unit too long"),
  estimatedPrice: priceSchema.optional().nullable(),
  notes: z.string().max(500, "Notes too long").optional().nullable(),
});

export type CreatePlanningItemInput = z.infer<typeof createPlanningItemSchema>;

// Update planning item schema
export const updatePlanningItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  quantity: quantitySchema.optional(),
  unit: z.string().min(1).max(50).optional(),
  estimatedPrice: priceSchema.optional().nullable(),
  actualPrice: priceSchema.optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type UpdatePlanningItemInput = z.infer<typeof updatePlanningItemSchema>;
