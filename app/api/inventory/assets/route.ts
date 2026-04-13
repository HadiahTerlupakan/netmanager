import { NextRequest } from "next/server";
import { AssetService } from "@/modules/inventory";
import { z, ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
} from "@/lib/api-response";

const assetService = new AssetService();

import { AssetStatus } from "@prisma/client";

// Schema for creating asset
const createAssetSchema = z.object({
  barangId: z.string().min(1, "Barang wajib dipilih"),
  kodeAsset: z.string().min(1, "Kode Asset wajib diisi"),
  purchaseDate: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
  purchasePrice: z.number().min(0),
  usefulLife: z.number().int().min(1),
  residualValue: z.number().min(0).optional().default(0),
  status: z.enum(AssetStatus).optional(),
  location: z.string().optional(),
  assignedTo: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    // Permission check
    if (!(await hasPermission("asset:read"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk melihat data aset",
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 10;
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status")
      ? (searchParams.get("status") as AssetStatus)
      : undefined;

    const result = await assetService.findAllAssets({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    });

    return apiSuccess({
      assets: result.items,
      total: result.total,
      page,
      limit,
    });
  } catch (error: unknown) {
    console.error("Failed to fetch assets:", error);
    const message =
      error instanceof Error ? error.message : "Gagal memuat data aset";
    return ApiErrors.internalError(message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    // Permission check
    if (!(await hasPermission("asset:create"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk membuat aset",
      );
    }

    const body = await req.json();
    const validated = createAssetSchema.parse(body);

    const {
      residualValue,
      status,
      location,
      assignedTo,
      purchaseDate,
      ...rest
    } = validated;

    const asset = await assetService.createAsset(
      {
        ...rest,
        purchaseDate: purchaseDate ?? new Date(),
        ...(residualValue !== undefined ? { residualValue } : {}),
        ...(status ? { status } : {}),
        ...(location ? { location } : {}),
        ...(assignedTo ? { assignedTo } : {}),
      },
      session.user.id,
    );

    return apiSuccess(
      { asset },
      { status: 201, message: "Aset berhasil dibuat" },
    );
  } catch (error: unknown) {
    console.error("Failed to create asset:", error);
    if (error instanceof ZodError) {
      return apiError("Validasi gagal", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
        details: { errors: error.issues },
      });
    }
    const message =
      error instanceof Error ? error.message : "Gagal membuat aset";
    return ApiErrors.internalError(message);
  }
}
