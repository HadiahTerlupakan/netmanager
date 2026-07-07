import * as z from "zod";

export const createResellerOutletSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
});

export const updateResellerOutletSchema = createResellerOutletSchema
  .partial()
  .extend({
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  });

export type CreateResellerOutletSchema = z.infer<
  typeof createResellerOutletSchema
>;
export type UpdateResellerOutletSchema = z.infer<
  typeof updateResellerOutletSchema
>;
