import { z } from "zod";

export const updateAppVersionSchema = z.object({
  releaseNotes: z.string().optional(),
  isForceUpdate: z.boolean().optional(),
  isActive: z.boolean().optional(),
  minVersion: z.string().optional(),
});

export type UpdateAppVersionInput = z.infer<typeof updateAppVersionSchema>;

const positiveIntegerString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+$/.test(value), {
    message: "versionCode harus berupa angka bulat positif",
  })
  .transform((value) => Number(value))
  .refine((value) => Number.isInteger(value) && value > 0, {
    message: "versionCode harus berupa angka bulat positif",
  });

export const reportMobileVersionSchema = z.object({
  versionCode: positiveIntegerString,
  versionName: z.string().trim().min(1).max(64).optional().nullable(),
});

export type ReportMobileVersionInput = z.infer<
  typeof reportMobileVersionSchema
>;

export const checkVersionQuerySchema = z.object({
  versionCode: positiveIntegerString,
  platform: z.enum(["android", "ios", "all"]).optional().default("android"),
});

export type CheckVersionQuery = z.infer<typeof checkVersionQuerySchema>;

export const APP_VERSION_MAX_APK_BYTES = 500 * 1024 * 1024;
