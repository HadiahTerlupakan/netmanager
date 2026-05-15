import {
  APP_UPDATE_MAX_BUNDLE_BYTES,
  appUpdateChannelSchema,
  appUpdatePlatformSchema,
  runtimeVersionSchema,
} from "@/modules/app-update";
import type { AppUpdateChannel, AppUpdatePlatform } from "@/modules/app-update";

export interface ParsedAppUpdateForm {
  channel: AppUpdateChannel;
  platform: AppUpdatePlatform;
  runtimeVersion: string;
  manifest: Record<string, unknown>;
  bundleFile: File;
  assetFiles: File[];
  releaseNotes?: string;
}

export interface ParseFailure {
  error: string;
  status: 400;
}

export type ParseResult =
  | { ok: true; data: ParsedAppUpdateForm; failure?: undefined }
  | { ok: false; failure: ParseFailure; data?: undefined };

export function parseAppUpdateUploadForm(formData: FormData): ParseResult {
  const channelResult = appUpdateChannelSchema.safeParse(
    formData.get("channel"),
  );
  if (!channelResult.success) {
    return fail("channel wajib 'staging' atau 'production'");
  }
  const platformResult = appUpdatePlatformSchema.safeParse(
    formData.get("platform"),
  );
  if (!platformResult.success) {
    return fail("platform wajib 'android' atau 'ios'");
  }
  const runtimeResult = runtimeVersionSchema.safeParse(
    formData.get("runtimeVersion"),
  );
  if (!runtimeResult.success) {
    return fail(
      runtimeResult.error.issues[0]?.message ?? "runtimeVersion tidak valid",
    );
  }

  const manifestRaw = formData.get("manifest");
  if (typeof manifestRaw !== "string") {
    return fail("manifest JSON wajib disertakan");
  }
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestRaw) as Record<string, unknown>;
  } catch {
    return fail("manifest harus JSON valid");
  }

  const bundleEntry = formData.get("bundle");
  if (!(bundleEntry instanceof File) || bundleEntry.size === 0) {
    return fail("bundle file wajib disertakan");
  }
  if (bundleEntry.size > APP_UPDATE_MAX_BUNDLE_BYTES) {
    const maxMb = Math.round(APP_UPDATE_MAX_BUNDLE_BYTES / (1024 * 1024));
    return fail(`Bundle melebihi batas maksimal ${maxMb}MB`);
  }

  const assetFiles = formData
    .getAll("assets")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const releaseNotes = formData.get("releaseNotes");
  const releaseNotesString =
    typeof releaseNotes === "string" ? releaseNotes : undefined;

  return {
    ok: true,
    data: {
      channel: channelResult.data,
      platform: platformResult.data,
      runtimeVersion: runtimeResult.data,
      manifest,
      bundleFile: bundleEntry,
      assetFiles,
      ...(releaseNotesString ? { releaseNotes: releaseNotesString } : {}),
    },
  };
}

function fail(error: string): ParseResult {
  return { ok: false, failure: { error, status: 400 } };
}
