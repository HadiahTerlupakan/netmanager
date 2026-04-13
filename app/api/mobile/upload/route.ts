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

async function isTrustedMobileUploadUrl(url: URL, request: NextRequest) {
  const host = request.headers.get("host");
  const allowedHost = host ? `${url.protocol}//${host}` : null;
  const isSameHost = allowedHost
    ? `${url.protocol}//${url.host}` === allowedHost
    : false;
  const isRelativeUploadPath = url.pathname.startsWith("/uploads/");
  const isDefaultR2Url = url.hostname.endsWith(".r2.cloudflarestorage.com");

  if (!isRelativeUploadPath) {
    return false;
  }

  if (isSameHost || isDefaultR2Url) {
    return true;
  }

  const r2Settings = await getR2Settings();
  const publicPrefix = r2Settings?.publicUrl?.replace(/\/$/, "");

  return publicPrefix ? url.toString().startsWith(`${publicPrefix}/`) : false;
}

/**
 * POST /api/mobile/upload
 * Mobile file upload endpoint with token auth
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

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
    console.error("Mobile upload delete error:", error);
    return apiError(
      error instanceof Error ? error.message : "Failed to delete file",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as UploadType) || "general";
    const subFolder = (formData.get("subFolder") as string) || undefined;
    const watermarkLinesStr = formData.get("watermarkLines") as string | null;

    let watermarkLines: string[] | undefined;
    if (watermarkLinesStr) {
      try {
        watermarkLines = JSON.parse(watermarkLinesStr);
      } catch (e) {
        console.warn("Invalid watermark lines JSON", e);
      }
    }

    // Validate required fields
    if (!file) {
      return apiError("File wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    // Validate file is an image
    if (!isImageFile(file)) {
      return apiError(
        "Hanya file gambar yang diperbolehkan",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return apiError(
        "Ukuran file melebihi batas 10MB",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    // Generate filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = `${timestamp}_${randomStr}`;

    // Determine upload directory based on type
    let uploadDir: string;
    switch (type) {
      case "inventory-masuk":
        uploadDir = path.join(
          process.cwd(),
          "public",
          "uploads",
          "inventory",
          "masuk",
        );
        break;
      case "inventory-keluar":
        uploadDir = path.join(
          process.cwd(),
          "public",
          "uploads",
          "inventory",
          "keluar",
        );
        break;
      case "employee-attendance":
        uploadDir = path.join(
          process.cwd(),
          "public",
          "uploads",
          "employee",
          "attendance",
        );
        break;
      case "work-order-updates":
        uploadDir = path.join(
          process.cwd(),
          "public",
          "uploads",
          "workorder",
          "updates",
        );
        break;
      case "workorder-completion":
        uploadDir = path.join(
          process.cwd(),
          "public",
          "uploads",
          "workorder",
          "completion",
        );
        break;
      case "marketing":
        uploadDir = path.join(
          process.cwd(),
          "public",
          "uploads",
          "marketing",
          "canvasing",
        );
        break;
      default:
        uploadDir = path.join(
          process.cwd(),
          "public",
          "uploads",
          "mobile",
          "general",
        );
    }

    // If subFolder, append to path
    if (subFolder) {
      uploadDir = path.join(uploadDir, subFolder);
    }

    // Upload and convert image
    const url = await convertAndSaveImage(
      file,
      uploadDir,
      fileName,
      type ?? undefined,
      subFolder,
      watermarkLines,
    );

    // Construct absolute URL
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    const baseUrl = `${protocol}://${host}`;
    const absoluteUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

    return NextResponse.json({
      success: true,
      url: absoluteUrl,
      data: {
        url: absoluteUrl,
        fileName: `${fileName}.webp`,
      },
    });
  } catch (error: unknown) {
    console.error("Mobile upload error:", error);
    return apiError(
      error instanceof Error ? error.message : "Failed to upload file",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }
}
