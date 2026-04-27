import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getInventoryRouteService } from "@/modules/inventory";
import { logger } from "@/lib/logger";
import {
  validateInventoryPhotos,
  uploadInventoryPhotos,
} from "@/lib/utils/image-upload";
import * as path from "path";

const inventoryRouteService = getInventoryRouteService();

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
    const photos = formData.getAll("photos") as File[];
    const validPhotos = photos.filter(
      (file): file is File => file instanceof File && file.size > 0,
    );
    const transactionId = formData.get("transactionId") as string;
    const transactionType = formData.get("transactionType") as
      | "inventory-masuk"
      | "inventory-keluar"
      | "inventory-transfer";

    if (!transactionId) {
      return NextResponse.json(
        { error: "ID Transaksi wajib disertakan" },
        { status: 400 },
      );
    }

    if (
      !transactionType ||
      ![
        "inventory-masuk",
        "inventory-keluar",
        "inventory-transfer",
        "finance-transaction",
      ].includes(transactionType)
    ) {
      return NextResponse.json(
        {
          error:
            "Tipe transaksi tidak valid. Gunakan: inventory-masuk, inventory-keluar, inventory-transfer, atau finance-transaction",
        },
        { status: 400 },
      );
    }

    if (validPhotos.length === 0) {
      return NextResponse.json(
        { error: "Minimal 1 foto harus diunggah" },
        { status: 400 },
      );
    }

    const validation = validateInventoryPhotos(validPhotos, 5, 5);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "Validasi foto gagal: " + validation.errors.join(", "),
          details: validation.errors,
        },
        { status: 400 },
      );
    }

    if (!transactionId.startsWith("temp-")) {
      const dbStart = Date.now();
      const transaction =
        await inventoryRouteService.verifyInventoryTransaction({
          transactionId,
          transactionType,
        });

      if (!transaction) {
        const errorByType: Record<string, string> = {
          "inventory-masuk": "Transaksi barang masuk tidak ditemukan",
          "inventory-keluar": "Transaksi barang keluar tidak ditemukan",
          "inventory-transfer": "Transaksi transfer tidak ditemukan",
        };
        return NextResponse.json(
          {
            error: errorByType[transactionType] || "Transaksi tidak ditemukan",
          },
          { status: 404 },
        );
      }

      logger.dbOperation("findUnique", transactionType, Date.now() - dbStart);
    }

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      transactionType,
      new Date().getFullYear().toString(),
      String(new Date().getMonth() + 1).padStart(2, "0"),
    );
    const uploadedUrls = await uploadInventoryPhotos(
      validPhotos,
      transactionId,
      transactionType,
      uploadDir,
    );

    logger.apiRequest(
      "POST",
      "/api/inventory/upload-photo",
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        transactionId,
        transactionType,
        photoCount: uploadedUrls.length,
      },
    );

    return NextResponse.json({
      success: true,
      message: `${uploadedUrls.length} photo(s) uploaded successfully`,
      data: {
        urls: uploadedUrls,
        transactionId,
        transactionType,
        count: uploadedUrls.length,
      },
    });
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
