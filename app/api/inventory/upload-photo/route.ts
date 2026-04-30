import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  inventoryPhotoQueryService,
  inventoryPhotoUploadService,
} from "@/modules/inventory";
import { logger } from "@/lib/logger";
import type {
  InventoryPhotoQueryResult,
  InventoryPhotoUploadResult,
} from "@/modules/inventory";

type InventoryPhotoQueryError = Extract<
  InventoryPhotoQueryResult,
  { ok: false }
>;
type InventoryPhotoUploadError = Extract<
  InventoryPhotoUploadResult,
  { ok: false }
>;

function isUploadError(
  result: InventoryPhotoUploadResult,
): result is InventoryPhotoUploadError {
  return !result.ok;
}

function isPhotoQueryError(
  result: InventoryPhotoQueryResult,
): result is InventoryPhotoQueryError {
  return !result.ok;
}

function createPhotoQueryErrorResponse(error: InventoryPhotoQueryError) {
  return NextResponse.json(error.body, { status: error.status });
}

/**
 * POST /api/inventory/upload-photo
 * Upload photos for inventory transactions.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await requireAdmin(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const formData = await request.formData();
    const transactionId = String(formData.get("transactionId") ?? "");
    const transactionType = String(formData.get("transactionType") ?? "");
    const result = await inventoryPhotoUploadService.upload({
      photos: formData.getAll("photos") as File[],
      transactionId,
      transactionType,
    });

    if (isUploadError(result)) {
      return NextResponse.json(result.body, { status: result.status });
    }

    logger.apiRequest(
      "POST",
      "/api/inventory/upload-photo",
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        transactionId,
        transactionType,
        photoCount: result.body.data.count,
      },
    );

    return NextResponse.json(result.body);
  } catch (error) {
    const err = error as Error;
    logger.error("Error in inventory photo upload endpoint", err, {
      path: "/api/inventory/upload-photo",
      method: "POST",
      ip: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      {
        error: "Terjadi kesalahan server",
        message: "Gagal memproses unggahan foto",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/inventory/upload-photo
 * Get information about uploaded photos for a transaction.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await requireAdmin(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const searchParams = request.nextUrl.searchParams;
    const queryResult = inventoryPhotoQueryService.getTransactionPhotoInfo({
      transactionId: searchParams.get("transactionId"),
      transactionType: searchParams.get("transactionType"),
    });

    if (isPhotoQueryError(queryResult)) {
      return createPhotoQueryErrorResponse(queryResult);
    }

    const successBody = queryResult.body;
    logger.apiRequest(
      "GET",
      "/api/inventory/upload-photo",
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        transactionId: successBody.transactionId,
        transactionType: successBody.transactionType,
      },
    );

    return NextResponse.json(successBody);
  } catch (error) {
    const err = error as Error;
    logger.error("Error in inventory photo GET endpoint", err, {
      path: "/api/inventory/upload-photo",
      method: "GET",
    });

    return NextResponse.json(
      { error: "Terjadi kesalahan server saat mengambil data foto" },
      { status: 500 },
    );
  }
}
