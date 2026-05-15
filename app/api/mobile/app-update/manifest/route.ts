import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getAppUpdateService, manifestQuerySchema } from "@/modules/app-update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Expo Updates manifest endpoint.
 *
 * Spec: mobile (expo-updates) hit URL ini dengan headers:
 *   expo-runtime-version: <runtimeVersion>
 *   expo-platform: ios|android
 *   expo-channel-name: <channel>
 *   expo-protocol-version: 1
 *
 * Server pilih row aktif terbaru lalu kembalikan manifest JSON + signature
 * via header `expo-signature` (format: `sig="<base64>", keyid="<keyId>"`).
 */
export async function GET(request: NextRequest) {
  const headers = request.headers;
  const channel = headers.get("expo-channel-name") ?? "production";
  const runtimeVersion = headers.get("expo-runtime-version") ?? "";
  const platform = headers.get("expo-platform") ?? "";

  const parsed = manifestQuerySchema.safeParse({
    channel,
    runtimeVersion,
    platform,
  });
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0]?.message ?? "Manifest header tidak valid",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400, details: { issues: parsed.error.issues } },
    );
  }

  try {
    const service = await getAppUpdateService();
    const update = await service.findLatestActive(parsed.data);
    if (!update) {
      // expo-updates spec: 204 ketika tidak ada update tersedia.
      return new NextResponse(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const baseUrl = resolveBaseUrl(request);
    const manifest = service.buildManifestForResponse({ baseUrl, update });

    const responseHeaders = new Headers({
      "Content-Type": manifest.contentType,
      "Cache-Control": "no-store",
      "expo-protocol-version": "1",
      "expo-sfv-version": "0",
    });
    if (manifest.signature && manifest.signatureKeyId) {
      responseHeaders.set(
        "expo-signature",
        `sig="${manifest.signature}", keyid="${manifest.signatureKeyId}", alg="rsa-v1_5-sha256"`,
      );
    }
    return new NextResponse(manifest.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    logger.error("[AppUpdateManifest] Failed to build manifest", error);
    return apiError(
      "Gagal mengambil manifest update",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}

function resolveBaseUrl(request: NextRequest): string {
  const explicit = process.env.APP_UPDATE_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? request.nextUrl.host;
  return `${proto}://${host}`;
}
