import { NextResponse } from "next/server";

import { createHandler, ApiErrors } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  createRestockGoodsReceiptService,
  RestockReceiptFailedError,
  RestockReceiptInvalidError,
  RestockReceiptNotFoundError,
} from "@/modules/inventory";

const goodsReceiptService = createRestockGoodsReceiptService();

/**
 * Terima barang dari pre-request restock via GRN service.
 * Mendukung substitusi barang bila yang datang berbeda dari yang dipesan.
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:verify"))) {
    return ApiErrors.forbidden("Akses ditolak. Butuh izin restock:verify");
  }

  const body = await req.json();

  try {
    const goodsReceipt = await goodsReceiptService.receive({
      purchaseRequestId: ctx.params.id,
      receivedItems: (body.items ?? {}) as Record<string, number>,
      substitutions: (body.substitutions ?? {}) as Record<string, string>,
      fotoBukti: (body.fotoBukti ?? []) as string[],
      closePO: Boolean(body.closePO),
      actorId: user.id as string,
      tenantId: user.tenantId as string,
    });

    return NextResponse.json({
      data: goodsReceipt,
      message: "Barang berhasil diterima dan GRN tercatat",
    });
  } catch (error) {
    if (error instanceof RestockReceiptNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    if (error instanceof RestockReceiptInvalidError) {
      return ApiErrors.badRequest(error.message);
    }
    if (error instanceof RestockReceiptFailedError) {
      return ApiErrors.internalError(error.message);
    }
    throw error;
  }
});
