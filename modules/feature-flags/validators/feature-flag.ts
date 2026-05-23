import { z } from "zod";
import { FEATURE_MODULES } from "@/lib/feature-modules";

const FEATURE_CODES = FEATURE_MODULES.map((m) => m.code) as [
  string,
  ...string[],
];

export const featureFlagUpdateSchema = z.object({
  feature: z.enum(FEATURE_CODES),
  enabled: z.boolean(),
});

export const featureFlagBatchUpdateSchema = z.object({
  updates: z.array(featureFlagUpdateSchema).min(1).max(64),
});

export type FeatureFlagUpdateInput = z.infer<typeof featureFlagUpdateSchema>;
export type FeatureFlagBatchUpdateInput = z.infer<
  typeof featureFlagBatchUpdateSchema
>;
