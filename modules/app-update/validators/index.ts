import { z } from "zod";

export const APP_UPDATE_CHANNELS = ["staging", "production"] as const;
export const APP_UPDATE_PLATFORMS = ["android", "ios"] as const;

export const appUpdateChannelSchema = z.enum(APP_UPDATE_CHANNELS);
export const appUpdatePlatformSchema = z.enum(APP_UPDATE_PLATFORMS);

const RUNTIME_VERSION_PATTERN = /^[\w.\-+]+$/;

export const runtimeVersionSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => RUNTIME_VERSION_PATTERN.test(value), {
    message: "runtimeVersion hanya boleh huruf, angka, '.', '-', '_', '+'",
  });

export const manifestQuerySchema = z.object({
  channel: appUpdateChannelSchema,
  runtimeVersion: runtimeVersionSchema,
  platform: appUpdatePlatformSchema,
});

export type ManifestQuery = z.infer<typeof manifestQuerySchema>;

export const APP_UPDATE_MAX_BUNDLE_BYTES = 200 * 1024 * 1024;
