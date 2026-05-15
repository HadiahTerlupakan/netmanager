import fs from "fs/promises";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getAppVersionService } from "@/modules/app-version";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

const APK_CONTENT_TYPE = "application/vnd.android.package-archive";

/**
 * Direct redirect ke R2 menyebabkan masalah di Android (cross-origin redirect
 * kehilangan download context dan APK tidak dikenali sebagai installable),
 * jadi kita stream konten lewat backend dengan Content-Disposition yang benar.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const service = await getAppVersionService();
    const apkInfo = await service.getApkForDownload(id);

    if (!apkInfo) {
      return apiError("APK tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    const isRemote =
      apkInfo.url.startsWith("http://") || apkInfo.url.startsWith("https://");

    return isRemote
      ? streamRemoteApk(apkInfo.url, apkInfo.filename)
      : await streamLocalApk(apkInfo.url, apkInfo.filename);
  } catch (error) {
    logger.error("Error downloading APK:", error);
    return apiError("Gagal mengunduh APK", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}

async function streamRemoteApk(apkUrl: string, filename: string) {
  try {
    const remoteResponse = await fetch(apkUrl);
    if (!remoteResponse.ok || !remoteResponse.body) {
      logger.error(
        "Error fetching APK from remote storage:",
        remoteResponse.status,
        remoteResponse.statusText,
      );
      return apiError(
        "Gagal mengunduh APK dari storage",
        ErrorCodes.INTERNAL_ERROR,
        { status: 502 },
      );
    }

    const headers = new Headers({
      "Content-Type": APK_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache",
    });
    const contentLength = remoteResponse.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new NextResponse(remoteResponse.body, { status: 200, headers });
  } catch (fetchError) {
    logger.error("Error proxying APK from remote storage:", fetchError);
    return apiError(
      "Gagal mengunduh APK dari storage",
      ErrorCodes.INTERNAL_ERROR,
      { status: 502 },
    );
  }
}

async function streamLocalApk(apkUrl: string, filename: string) {
  const filePath = path.join(process.cwd(), "public", apkUrl);

  try {
    const fileBuffer = await fs.readFile(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": APK_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (fileError) {
    logger.error("Error reading APK file:", fileError);
    return apiError(
      "APK file tidak ditemukan di server",
      ErrorCodes.NOT_FOUND,
      { status: 404 },
    );
  }
}
