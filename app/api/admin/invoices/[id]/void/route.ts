import { NextResponse } from "next/server";
import {
  createHandler,
  apiSuccess,
  buildSessionWithPermissions,
} from "@/lib/api";
import { responsPenolakanTagihan } from "@/lib/api/invoice-route";
import { VoidInvoiceService } from "@/modules/finance";
import { checkSiteRestriction } from "@/modules/roles";
import * as z from "zod";

/**
 * Validasi body request
 */
const voidSchema = z.object({
  reason: z.string().min(1, "Alasan pembatalan harus diisi"),
});

/**
 * POST /api/admin/invoices/[id]/void
 *
 * Endpoint untuk membatalkan tagihan yang sudah dibayar.
 * Melakukan refund status pada payment dan rollback jatuhTempo pelanggan.
 */
export const POST = createHandler(
  {
    auth: true,
    schema: voidSchema,
    permissions: ["finance:update:void"],
  },
  async (req, ctx) => {
    // ctx.params is already awaited and resolved by createHandler in lib/api/handler.ts
    const { id } = ctx.params;
    const { reason } = ctx.validated;
    const { isRestricted, siteIds } = checkSiteRestriction(
      buildSessionWithPermissions(ctx.session!, ctx.permissions),
      "finance",
    );
    const allowedSiteIds = isRestricted ? siteIds : undefined;

    const result = await VoidInvoiceService.voidInvoice(
      id,
      reason,
      ctx.session!.user.id,
      allowedSiteIds,
    ).catch(responsPenolakanTagihan);
    if (result instanceof NextResponse) return result;

    return apiSuccess(result.data, {
      message:
        "Tagihan berhasil dibatalkan dan status pembayaran telah di-refund",
    });
  },
);
