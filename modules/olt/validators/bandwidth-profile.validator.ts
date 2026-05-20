import { z } from "zod";

export const createBandwidthProfileSchema = z.object({
  oltId: z.string().min(1, "oltId wajib diisi"),
  name: z.string().min(1, "Nama profile wajib diisi").max(50),
  uploadRate: z.coerce.number().int().min(64, "Minimum 64 kbps"),
  downloadRate: z.coerce.number().int().min(64, "Minimum 64 kbps"),
  description: z.string().max(200).optional(),
});

export const updateBandwidthProfileSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  uploadRate: z.coerce.number().int().min(64).optional(),
  downloadRate: z.coerce.number().int().min(64).optional(),
  description: z.string().max(200).optional(),
});

export type CreateBandwidthProfileInput = z.infer<
  typeof createBandwidthProfileSchema
>;
export type UpdateBandwidthProfileInput = z.infer<
  typeof updateBandwidthProfileSchema
>;
