import * as z from "zod";

export const createResellerSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.email().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const updateResellerSchema = createResellerSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type CreateResellerSchema = z.infer<typeof createResellerSchema>;
export type UpdateResellerSchema = z.infer<typeof updateResellerSchema>;
