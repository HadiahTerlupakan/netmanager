import { z } from "zod";

export const updateOltCardSchema = z.object({
  cardType: z.string().max(50).nullable().optional(),
  ponCount: z.coerce.number().int().min(1).max(64).optional(),
  status: z.enum(["ACTIVE", "MAINTENANCE", "OFFLINE"]).optional(),
});

export const listOltCardsQuerySchema = z.object({
  oltId: z.string().min(1),
});

export type UpdateOltCardInput = z.infer<typeof updateOltCardSchema>;
export type ListOltCardsQuery = z.infer<typeof listOltCardsQuerySchema>;
