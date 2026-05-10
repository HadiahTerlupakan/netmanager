import { z } from "zod";

export const updateAppVersionSchema = z.object({
  releaseNotes: z.string().optional(),
  isForceUpdate: z.boolean().optional(),
  isActive: z.boolean().optional(),
  minVersion: z.string().optional(),
});

export type UpdateAppVersionInput = z.infer<typeof updateAppVersionSchema>;
