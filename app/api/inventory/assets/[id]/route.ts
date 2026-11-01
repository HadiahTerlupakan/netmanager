import { NextRequest } from "next/server";
import {
  AssetService,
  describeZodIssues,
  PESAN_BELUM_MASUK,
  PESAN_DATA_TIDAK_TERBACA,
  pesanGagalMuat,
  pesanGagalSimpan,
  pesanTanpaIzin,
  pesanTidakDitemukan,
  translateAssetError,
  updateAssetSchema,
} from "@/modules/inventory";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { masterDataFailureResponse } from "../../master-data-response";

const assetService = new AssetService();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return ApiErrors.unauthorized(PESAN_BELUM_MASUK);
    }

    if (!(await hasPermission("asset:read"))) {
      return ApiErrors.forbidden(pesanTanpaIzin("melihat data aset"));
    }

    const { id } = await params;
    const asset = await assetService.getAsset(id);
    if (!asset) {
      return ApiErrors.notFound(pesanTidakDitemukan("Aset"));
    }

    return apiSuccess({ asset });
  } catch (error: unknown) {
    logger.error("Detail aset gagal dimuat", error);
    return ApiErrors.internalError(pesanGagalMuat("aset"));
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return ApiErrors.unauthorized(PESAN_BELUM_MASUK);
  }

  if (!(await hasPermission("asset:update"))) {
    return ApiErrors.forbidden(pesanTanpaIzin("mengubah data aset"));
  }

  const body = await req.json().catch((): null => null);
  if (!body || typeof body !== "object") {
    return ApiErrors.badRequest(PESAN_DATA_TIDAK_TERBACA);
  }

  const parsed = updateAssetSchema.safeParse(body);
  if (!parsed.success) {
    return masterDataFailureResponse(describeZodIssues(parsed.error));
  }

  const { kodeAsset, status, location, assignedTo } = parsed.data;
  const { id } = await params;
  try {
    const updated = await assetService.updateAsset(id, {
      ...(kodeAsset ? { kodeAsset } : {}),
      ...(status ? { status } : {}),
      ...(location ? { location } : {}),
      ...(assignedTo ? { assignedTo } : {}),
    });

    return apiSuccess(
      { asset: updated },
      { message: "Aset berhasil diperbarui" },
    );
  } catch (error: unknown) {
    return masterDataFailureResponse(
      translateAssetError(error, {
        message: pesanGagalSimpan("Perubahan aset"),
        logContext: "Aset gagal diubah",
      }),
    );
  }
}
