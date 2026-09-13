import { z } from "zod";
import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { requireCustomerAuth } from "@/lib/customer-auth";
import {
  apiSuccess,
  apiError,
  ApiErrors,
  ErrorCodes,
} from "@/lib/api-response";
import {
  CustomerPackageUpgradeError,
  getCustomerPackageUpgradeService,
} from "@/modules/pelanggan";

const upgradeRequestSchema = z.object({
  // Pesan dipasang di level tipe juga: kalau field-nya hilang sama sekali,
  // error tipe yang muncul lebih dulu — bukan `min`.
  packageId: z
    .string({ error: "Paket tujuan wajib dipilih" })
    .min(1, "Paket tujuan wajib dipilih"),
});

/** Kode error service dipetakan ke status HTTP yang sesuai. */
const ERROR_STATUS: Record<string, number> = {
  CUSTOMER_NOT_FOUND: 404,
  CURRENT_PACKAGE_NOT_FOUND: 404,
  CUSTOMER_NOT_ACTIVE: 403,
  UPGRADE_ALREADY_PENDING: 409,
  NO_PENDING_UPGRADE: 409,
  PACKAGE_NOT_AVAILABLE: 400,
};

/** Ubah error service jadi respons HTTP; error lain dianggap kegagalan server. */
function toErrorResponse(error: unknown, logPrefix: string) {
  if (error instanceof CustomerPackageUpgradeError) {
    return apiError(error.message, ErrorCodes.VALIDATION_ERROR, {
      status: ERROR_STATUS[error.code] ?? 400,
    });
  }

  logger.error(logPrefix, error);
  return ApiErrors.internalError("Gagal memproses permintaan upgrade");
}

/**
 * POST - Ajukan upgrade paket untuk pelanggan yang sedang login.
 * Perubahan dijadwalkan pada siklus tagihan berikutnya.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const parsed = upgradeRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Input tidak valid";
      return apiError(firstError, ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    const result = await getCustomerPackageUpgradeService().requestUpgrade(
      authResult.session.id,
      parsed.data.packageId,
    );

    return apiSuccess(result, {
      message: "Pengajuan upgrade berhasil dijadwalkan",
    });
  } catch (error) {
    return toErrorResponse(error, "[Customer Package Upgrade Error]:");
  }
}

/**
 * DELETE - Batalkan pengajuan upgrade yang belum diterapkan.
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const result = await getCustomerPackageUpgradeService().cancelUpgrade(
      authResult.session.id,
    );

    return apiSuccess(result, {
      message: "Pengajuan upgrade dibatalkan",
    });
  } catch (error) {
    return toErrorResponse(error, "[Customer Package Upgrade Cancel Error]:");
  }
}
