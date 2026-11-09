import { NextResponse } from "next/server";

import { createHandler, ApiErrors } from "@/lib/api";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  createRestockPurchaseSignatureReader,
  restockForbiddenMessage,
} from "@/modules/inventory";
import { ensureRestockRequestSiteAccess } from "../../../../../_lib/restock-site-access";

const signatureReader = createRestockPurchaseSignatureReader();
const SIGNATURE_NOT_FOUND = "Tanda tangan tidak ditemukan.";

/** Header gambar tanda tangan: privat, tanpa cache, tidak bisa dieksekusi. */
const SIGNATURE_HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Disposition": 'inline; filename="ttd.png"',
  "Content-Security-Policy": "default-src 'none'; sandbox",
} as const;

/**
 * Gambar tanda tangan pembeli untuk satu catatan belanja. Tidak ada URL
 * publik; gambar dibaca dari penyimpanan setelah izin & kepemilikan dicek.
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const tenantId = user.tenantId as string;

  if (!(await hasPermission("restock:read"))) {
    return ApiErrors.forbidden(restockForbiddenMessage("restock:read"));
  }
  const siteDenied = await ensureRestockRequestSiteAccess({
    user,
    purchaseRequestId: ctx.params.id,
    tenantId,
  });
  if (siteDenied) return siteDenied;

  try {
    const image = await signatureReader.read({
      purchaseRequestId: ctx.params.id,
      recordId: ctx.params.recordId,
      tenantId,
    });
    if (!image) return ApiErrors.notFound(SIGNATURE_NOT_FOUND);
    return new NextResponse(new Uint8Array(image), {
      status: 200,
      headers: SIGNATURE_HEADERS,
    });
  } catch (error) {
    logger.error(
      "Error reading restock purchase signature",
      error instanceof Error ? error : new Error(String(error)),
      { purchaseRequestId: ctx.params.id, recordId: ctx.params.recordId },
    );
    return ApiErrors.notFound(SIGNATURE_NOT_FOUND);
  }
});
