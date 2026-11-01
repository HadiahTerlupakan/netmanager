import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import {
  AssetService,
  createAssetSchema,
  describeZodIssues,
  PESAN_BELUM_MASUK,
  PESAN_DATA_TIDAK_TERBACA,
  pesanGagalMuat,
  pesanGagalSimpan,
  pesanTanpaIzin,
  translateAssetError,
  type AssetStatusValue,
} from "@/modules/inventory";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { masterDataFailureResponse } from "../master-data-response";

const assetService = new AssetService();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return ApiErrors.unauthorized(PESAN_BELUM_MASUK);
    }

    if (!(await hasPermission("asset:read"))) {
      return ApiErrors.forbidden(pesanTanpaIzin("melihat data aset"));
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 10;
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") as AssetStatusValue | null;

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
    logger.error("Failed to fetch assets:", error);
    return ApiErrors.internalError(pesanGagalMuat("aset"));
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return ApiErrors.unauthorized(PESAN_BELUM_MASUK);
  }

  if (!(await hasPermission("asset:create"))) {
    return ApiErrors.forbidden(pesanTanpaIzin("menambah aset"));
  }

  const body = await req.json().catch((): null => null);
  if (!body || typeof body !== "object") {
    return ApiErrors.badRequest(PESAN_DATA_TIDAK_TERBACA);
  }

  const parsed = createAssetSchema.safeParse(body);
  if (!parsed.success) {
    return masterDataFailureResponse(describeZodIssues(parsed.error));
  }

  const { residualValue, status, location, assignedTo, purchaseDate, ...rest } =
    parsed.data;

  try {
    const asset = await assetService.createAsset(
      {
        ...rest,
        purchaseDate,
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
    return masterDataFailureResponse(
      translateAssetError(error, {
        message: pesanGagalSimpan("Aset"),
        logContext: "Aset gagal dibuat",
      }),
    );
  }
}
