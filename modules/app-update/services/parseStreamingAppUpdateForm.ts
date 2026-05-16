import { Readable } from "stream";

import Busboy from "@fastify/busboy";

import type {
  AppUpdateChannel,
  AppUpdatePlatform,
} from "../domain/entities/AppUpdateEntity";

import {
  APP_UPDATE_MAX_BUNDLE_BYTES,
  appUpdateChannelSchema,
  appUpdatePlatformSchema,
  runtimeVersionSchema,
} from "../validators";

export interface ParsedAppUpdateForm {
  channel: AppUpdateChannel;
  platform: AppUpdatePlatform;
  runtimeVersion: string;
  manifest: Record<string, unknown>;
  bundleFile: File;
  assetFiles: File[];
  releaseNotes?: string;
}

interface UploadedFile {
  file: File;
  fieldname: string;
}

/**
 * Parse multipart body langsung lewat busboy (bypass Next.js Request.formData
 * yang punya hidden 10MB body clone limit di App Router).
 *
 * Streaming sederhana: setiap field/file dibuffer ke memory dan dibungkus
 * sebagai File. Untuk endpoint publish OTA, total payload ≤ ~50–100MB
 * (bundle 12MB + assets ~30MB) jadi memory footprint masih reasonable.
 */
export async function parseStreamingAppUpdateForm(
  request: Request,
): Promise<
  | { ok: true; data: ParsedAppUpdateForm; failure?: undefined }
  | { ok: false; failure: { error: string; status: 400 }; data?: undefined }
> {
  if (!request.body) {
    return fail("Request body kosong");
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return fail("Content-Type harus multipart/form-data");
  }

  const fields: Record<string, string> = {};
  const files: UploadedFile[] = [];

  await new Promise<void>((resolve, reject) => {
    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: {
        fileSize: APP_UPDATE_MAX_BUNDLE_BYTES,
        files: 200,
      },
    });

    busboy.on("field", (name: string, value: string) => {
      fields[name] = value;
    });

    busboy.on(
      "file",
      (
        fieldname: string,
        fileStream: Readable,
        info: { filename?: string; mimeType?: string },
      ) => {
        const chunks: Buffer[] = [];
        fileStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        fileStream.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const file = new File([buffer], info.filename ?? fieldname, {
            type: info.mimeType ?? "application/octet-stream",
          });
          files.push({ fieldname, file });
        });
        fileStream.on("error", reject);
      },
    );

    busboy.on("error", reject);
    busboy.on("finish", resolve);

    Readable.fromWeb(request.body as never)
      .on("error", reject)
      .pipe(busboy);
  });

  return validateFields(fields, files);
}

function validateFields(
  fields: Record<string, string>,
  files: UploadedFile[],
):
  | { ok: true; data: ParsedAppUpdateForm; failure?: undefined }
  | { ok: false; failure: { error: string; status: 400 }; data?: undefined } {
  const channelResult = appUpdateChannelSchema.safeParse(fields.channel);
  if (!channelResult.success) {
    return fail("channel wajib 'staging' atau 'production'");
  }
  const platformResult = appUpdatePlatformSchema.safeParse(fields.platform);
  if (!platformResult.success) {
    return fail("platform wajib 'android' atau 'ios'");
  }
  const runtimeResult = runtimeVersionSchema.safeParse(fields.runtimeVersion);
  if (!runtimeResult.success) {
    return fail(
      runtimeResult.error.issues[0]?.message ?? "runtimeVersion tidak valid",
    );
  }

  const manifestRaw = fields.manifest;
  if (typeof manifestRaw !== "string") {
    return fail("manifest JSON wajib disertakan");
  }
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestRaw) as Record<string, unknown>;
  } catch {
    return fail("manifest harus JSON valid");
  }

  const bundleEntry = files.find((entry) => entry.fieldname === "bundle");
  if (!bundleEntry || bundleEntry.file.size === 0) {
    return fail("bundle file wajib disertakan");
  }
  if (bundleEntry.file.size > APP_UPDATE_MAX_BUNDLE_BYTES) {
    const maxMb = Math.round(APP_UPDATE_MAX_BUNDLE_BYTES / (1024 * 1024));
    return fail(`Bundle melebihi batas maksimal ${maxMb}MB`);
  }

  const assetFiles = files
    .filter((entry) => entry.fieldname === "assets" && entry.file.size > 0)
    .map((entry) => entry.file);

  const releaseNotes = fields.releaseNotes;

  return {
    ok: true,
    data: {
      channel: channelResult.data,
      platform: platformResult.data,
      runtimeVersion: runtimeResult.data,
      manifest,
      bundleFile: bundleEntry.file,
      assetFiles,
      ...(typeof releaseNotes === "string" && releaseNotes.trim()
        ? { releaseNotes }
        : {}),
    },
  };
}

function fail(error: string): {
  ok: false;
  failure: { error: string; status: 400 };
} {
  return { ok: false, failure: { error, status: 400 } };
}
