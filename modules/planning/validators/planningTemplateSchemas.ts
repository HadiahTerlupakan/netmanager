import { z } from "zod";

/**
 * Validation schemas for Planning Template CRUD operations
 */

// Template item schema
export const templateItemSchema = z.object({
  name: z.string().min(1, "Item name required").max(200, "Name too long"),
  description: z
    .string()
    .max(500, "Description too long")
    .optional()
    .nullable(),
  // Sejalan dengan `planningItemSchemas`: kuantitas BOQ boleh pecahan (kolom
  // Prisma `Float`, satuan bebas teks) dan harga nol adalah nilai sah.
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.string().min(1, "Unit required").max(50, "Unit too long"),
  estimatedPrice: z
    .number()
    .nonnegative("Price cannot be negative")
    .optional()
    .nullable(),
});

export type TemplateItemInput = z.infer<typeof templateItemSchema>;

// Create template schema
export const createPlanningTemplateSchema = z.object({
  name: z.string().min(1, "Template name required").max(200, "Name too long"),
  description: z
    .string()
    .max(500, "Description too long")
    .optional()
    .nullable(),
  type: z.enum(["OSP"]),
  isActive: z.boolean().default(true).optional(),
  items: z.array(templateItemSchema).min(1, "At least one item required"),
});

export type CreatePlanningTemplateInput = z.infer<
  typeof createPlanningTemplateSchema
>;

// Update template schema
export const updatePlanningTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  items: z
    .array(templateItemSchema)
    .min(1, "At least one item required")
    .optional(),
});

export type UpdatePlanningTemplateInput = z.infer<
  typeof updatePlanningTemplateSchema
>;

// List templates schema
export const listPlanningTemplateSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(["OSP"]).optional(),
  // Bukan `z.coerce.boolean()`: nilainya datang sebagai string query param dan
  // `Boolean("false") === true`, sehingga `?isActive=false` justru mengembalikan
  // template yang aktif — filter dengan satu keluaran, dan template nonaktif
  // tidak pernah bisa dilihat.
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type ListPlanningTemplateInput = z.infer<
  typeof listPlanningTemplateSchema
>;

// Apply template schema
export const applyTemplateSchema = z.object({
  title: z.string().min(1, "Title required").max(200, "Title too long"),
  description: z.string().optional().nullable(),
  area: z.string().min(1, "Area required").max(200, "Area too long"),
  // Form "Terapkan Template" menandai Estimasi Unit sebagai wajib. Sebelumnya
  // field ini tidak ada di schema sehingga isian pengguna dibuang saat validasi
  // dan planning selalu lahir dengan estimatedUnits 0.
  estimatedUnits: z.number().int().positive("Estimated units must be positive"),
  coordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional()
    .nullable(),
  startDate: z.string().datetime().optional().nullable(),
  targetCompletionDate: z.string().datetime().optional().nullable(),
});

export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;
