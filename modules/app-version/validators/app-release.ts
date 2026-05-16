import { z } from "zod";

export const APP_RELEASE_PLATFORMS = ["android", "ios"] as const;
export const APP_RELEASE_ARCHITECTURES = [
  "arm64-v8a",
  "armeabi-v7a",
  "x86_64",
  "universal",
] as const;

const semverPattern = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;

export const appReleasePlatformSchema = z.enum(APP_RELEASE_PLATFORMS);
export const appReleaseArchitectureSchema = z.enum(APP_RELEASE_ARCHITECTURES);

export const versionStringSchema = z.string().regex(semverPattern, {
  message: "Versi harus format semver (contoh: 1.0.8)",
});

export const appReleaseCreateSchema = z.object({
  platform: appReleasePlatformSchema,
  version: versionStringSchema,
  versionCode: z.number().int().positive(),
  isForceUpdate: z.boolean().default(false),
  minSupportedVersion: versionStringSchema.optional().nullable(),
  downloadUrl: z.url(),
  releaseNotes: z.string().max(5000).optional().nullable(),
  isActive: z.boolean().default(true),
  architecture: appReleaseArchitectureSchema.optional().nullable(),
  minOsVersion: z.string().max(20).optional().nullable(),
  rolloutPercentage: z.number().int().min(0).max(100).default(100),
  // Tetap number karena JSON tidak support BigInt natively.
  // Konversi ke bigint dilakukan di service layer saat construct AppReleaseCreateInput.
  // Ukuran APK realistis < Number.MAX_SAFE_INTEGER (~9 PB), jadi aman.
  apkSizeBytes: z.number().int().positive().optional().nullable(),
});

export const appReleaseUpdateSchema = appReleaseCreateSchema.partial().omit({
  platform: true,
  version: true,
  versionCode: true,
});

export const versionCheckQuerySchema = z.object({
  platform: appReleasePlatformSchema,
  currentVersion: versionStringSchema,
  currentVersionCode: z.coerce.number().int().nonnegative(),
});

export type AppReleaseCreateDto = z.infer<typeof appReleaseCreateSchema>;
export type AppReleaseUpdateDto = z.infer<typeof appReleaseUpdateSchema>;
export type VersionCheckQuery = z.infer<typeof versionCheckQuerySchema>;
