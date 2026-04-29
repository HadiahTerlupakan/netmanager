import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import {
  convertAndSaveImage,
  deleteUploadedFile,
  getR2Settings,
  isImageFile,
} from "@/lib/utils/image-upload";
import type { UploadType } from "@/lib/utils/image-upload";
import path from "path";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Check whether target upload URL is trusted for mobile deletion. */
async function isTrustedMobileUploadUrl(url: URL, request: NextRequest) {
  const host = request.headers.get("host");
  const allowedHost = host ? `${url.protocol}//${host}` : null;
  const isSameHost = allowedHost
    ? `${url.protocol}//${url.host}` === allowedHost
    : false;
  const isRelativeUploadPath = url.pathname.startsWith("/uploads/");
  const isDefaultR2Url = url.hostname.endsWith(".r2.cloudflarestorage.com");
  if (!isRelativeUploadPath) return false;
  if (isSameHost || isDefaultR2Url) return true;

  const r2Settings = await getR2Settings();
  const publicPrefix = r2Settings?.publicUrl?.replace(/\/$/, "");
  return publicPrefix ? url.toString().startsWith(`${publicPrefix}/`) : false;
}

/** Resolve upload base directory by mobile upload type. */
function resolveUploadDir(type: UploadType) {
  switch (type) {
    case "inventory-masuk":
      return path.join(
        process.cwd(),
        "public",
        "uploads",
        "inventory",
        "masuk",
      );
    case "inventory-keluar":
      return path.join(
        process.cwd(),
        "public",
        "uploads",
        "inventory",
        "keluar",
      );
    case "employee-attendance":
      return path.join(
        process.cwd(),
        "public",
        "uploads",
        "employee",
        "attendance",
      );
    case "work-order-updates":
      return path.join(
        process.cwd(),
        "public",
        "uploads",
        "workorder",
        "updates",
      );
    case "workorder-completion":
      return path.join(
        process.cwd(),
        "public",
        "uploads",
        "workorder",
        "completion",
      );
    case "marketing":
      return path.join(
        process.cwd(),
        "public",
        "uploads",
        "marketing",
        "canvasing",
      );
    default:
      return path.join(process.cwd(), "public", "uploads", "mobile", "general");
  }
}

/** Resolve valid absolute public URL from upload result. */
function resolveAbsoluteUrl(request: NextRequest, url: string) {
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host");
  const baseUrl = `${protocol}://${host}`;
  return url.startsWith("http") ? url : `${baseUrl}${url}`;
}

/** Handle mobile upload delete request. */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) return authResult;

    const targetUrl = request.nextUrl.searchParams.get("url");
    if (!targetUrl) {
      return apiError("URL upload wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return apiError("URL upload tidak valid", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    if (!(await isTrustedMobileUploadUrl(parsedUrl, request))) {
      return apiError("URL upload tidak diizinkan", ErrorCodes.FORBIDDEN, {
        status: 403,
      });
    }

    const deleted = await deleteUploadedFile(parsedUrl.toString());
    if (!deleted) {
      return apiError("File upload tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error("Mobile upload delete error:", error);
    return apiError(
      error instanceof Error ? error.message : "Failed to delete file",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}

/** Handle mobile image upload request. */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) return authResult;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as UploadType) || "general";
    const subFolder = (formData.get("subFolder") as string) || undefined;
    const watermarkLinesStr = formData.get("watermarkLines") as string | null;
    let watermarkLines: string[] | undefined;
    if (watermarkLinesStr) {
      try {
        watermarkLines = JSON.parse(watermarkLinesStr);
      } catch (error) {
        logger.warn("Invalid watermark lines JSON", error);
      }
    }

    if (!file) {
      return apiError("File wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }
    if (!isImageFile(file)) {
      return apiError(
        "Hanya file gambar yang diperbolehkan",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return apiError(
        "Ukuran file melebihi batas 10MB",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const uploadDir = subFolder
      ? path.join(resolveUploadDir(type), subFolder)
      : resolveUploadDir(type);
    const url = await convertAndSaveImage(
      file,
      uploadDir,
      fileName,
      type,
      subFolder,
      watermarkLines,
    );
    const absoluteUrl = resolveAbsoluteUrl(request, url);

    return NextResponse.json({
      success: true,
      url: absoluteUrl,
      data: { url: absoluteUrl, fileName: `${fileName}.webp` },
    });
  } catch (error: unknown) {
    logger.error("Mobile upload error:", error);
    return apiError(
      error instanceof Error ? error.message : "Failed to upload file",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}
