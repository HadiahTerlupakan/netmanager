import { createReadStream } from "fs";
import fs from "fs/promises";
import { Readable } from "stream";

import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getAppUpdateService } from "@/modules/app-update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve bundle / asset file untuk Expo Updates.
 *
 * Query:
 *   updateId  - id record AppUpdate
 *   hash      - sha256 hash bundle/asset
 *   type      - 'bundle' | 'asset'
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const updateId = searchParams.get("updateId");
  const hash = searchParams.get("hash");
  const type = searchParams.get("type");

  if (!updateId || !hash || (type !== "bundle" && type !== "asset")) {
    return apiError(
      "Query param updateId, hash, type wajib",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  try {
    const service = await getAppUpdateService();
    const resolved = await service.resolveAssetFile({
      updateId,
      hash,
      type,
    });
    if (!resolved) {
      return apiError("Asset tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    try {
      const stat = await fs.stat(resolved.filePath);
      const nodeStream = createReadStream(resolved.filePath);
      const webStream = Readable.toWeb(
        nodeStream,
      ) as ReadableStream<Uint8Array>;

      const headers = new Headers({
        "Content-Type": resolved.contentType,
        "Content-Length": String(stat.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      });

      return new NextResponse(webStream, { status: 200, headers });
    } catch (error) {
      logger.error("[AppUpdateAsset] file missing on disk", error);
      return apiError("Asset file tidak tersedia", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }
  } catch (error) {
    logger.error("[AppUpdateAsset] Failed to serve asset", error);
    return apiError("Gagal mengirim asset", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
