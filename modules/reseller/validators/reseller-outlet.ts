import * as z from "zod";

import { optionalTextSchema, outletStatusSchema } from "./shared";

export const createResellerOutletSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  phone: optionalTextSchema,
  address: optionalTextSchema,
  status: outletStatusSchema.optional(),
});

export const updateResellerOutletSchema = createResellerOutletSchema.partial();

export type CreateResellerOutletSchema = z.infer<
  typeof createResellerOutletSchema
>;
export type UpdateResellerOutletSchema = z.infer<
  typeof updateResellerOutletSchema
>;
