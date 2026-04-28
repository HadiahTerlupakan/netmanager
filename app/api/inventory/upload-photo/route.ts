import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { inventoryPhotoUploadService } from "@/modules/inventory";
import { logger } from "@/lib/logger";
import type { InventoryPhotoUploadResult } from "@/modules/inventory";

type InventoryPhotoUploadError = Extract<
  InventoryPhotoUploadResult,
  { ok: false }
>;

function isUploadError(
  result: InventoryPhotoUploadResult,
): result is InventoryPhotoUploadError {
  return !result.ok;
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
    const transactionId = searchParams.get("transactionId");
    const transactionType = searchParams.get("transactionType") as
      | "inventory-masuk"
      | "inventory-keluar";

    if (!transactionId) {
      return NextResponse.json(
        { error: "ID Transaksi wajib disertakan" },
        { status: 400 },
      );
    }

    if (
      !transactionType ||
      !["inventory-masuk", "inventory-keluar"].includes(transactionType)
    ) {
      return NextResponse.json(
        {
          error:
            'Tipe transaksi harus "inventory-masuk" atau "inventory-keluar"',
        },
        { status: 400 },
      );
    }

    logger.apiRequest(
      "GET",
      "/api/inventory/upload-photo",
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        transactionId,
        transactionType,
      },
    );

    return NextResponse.json({
      transactionId,
      transactionType,
      message:
        "Transaction found. Photo URLs would be returned here if stored in database.",
      note: "This endpoint can be extended to return uploaded photo URLs from a database table.",
      expectedPhotoPattern: {
        inventoryMasuk: `/uploads/inventory-masuk/[year]/[month]/${transactionId}_photo_[index].webp`,
        inventoryKeluar: `/uploads/inventory-keluar/[year]/[month]/${transactionId}_photo_[index].webp`,
      },
    });
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
