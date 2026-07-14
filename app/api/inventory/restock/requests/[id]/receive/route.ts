import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/rbac";
import { createHandler, ApiErrors } from "@/lib/api";
import { prisma } from "@/modules/database";
import {
  getGoodsReceiptService,
  GoodsReceiptInvalidError,
  ProcurementService,
  PurchaseOrderNotFoundError,
} from "@/modules/procurement";

/**
 * Terima barang dari pre-request restock via GRN service.
 * Membuat GRN agar stok tercatat, dokumen GRN muncul, dan jurnal
 * AUTO_GRN_CREATED terpicu (Dr Persediaan / Cr Hutang Usaha).
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:verify"))) {
    return ApiErrors.forbidden("Akses ditolak. Butuh izin restock:verify");
  }

  const { id } = ctx.params;
  const tenantId = user.tenantId as string;
  const actorId = user.id as string;

  const purchaseRequest = await prisma.purchaseRequest.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      purchaseOrderId: true,
      gudangId: true,
      status: true,
      nomorRequest: true,
    },
  });

  if (!purchaseRequest) {
    return ApiErrors.notFound("Purchase Request not found");
  }

  let purchaseOrderId = purchaseRequest.purchaseOrderId;
  if (!purchaseOrderId) {
    try {
      const procurementService = new ProcurementService();
      const purchaseOrders = await procurementService.generatePOFromPRs(
        [id],
        actorId,
      );
      purchaseOrderId = purchaseOrders?.[0]?.id ?? null;
    } catch {
      purchaseOrderId = null;
    }
  }

  if (!purchaseOrderId) {
    return ApiErrors.internalError(
      "Gagal membuat Purchase Order. Coba lagi atau hubungi admin.",
    );
  }

  const body = await req.json();
  const receivedItems = (body.items ?? {}) as Record<string, number>;
  const fotoBukti = (body.fotoBukti ?? []) as string[];
  const closePO = Boolean(body.closePO);

  if (fotoBukti.length === 0) {
    return ApiErrors.badRequest("Foto bukti penerimaan barang wajib diunggah");
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      items: {
        select: {
          id: true,
          barangId: true,
          quantity: true,
          receivedQuantity: true,
        },
      },
    },
  });

  if (!po) {
    return ApiErrors.notFound("Purchase Order not found");
  }

  const grnItems = po.items
    .map((poItem) => {
      const qty =
        receivedItems[poItem.barangId] ?? receivedItems[poItem.id] ?? 0;
      return {
        purchaseOrderItemId: poItem.id,
        barangId: poItem.barangId,
        quantity: Number(qty) || 0,
      };
    })
    .filter((item) => item.quantity > 0);

  if (grnItems.length === 0) {
    return ApiErrors.badRequest("Minimal satu barang harus diterima");
  }

  if (closePO) {
    for (const grnItem of grnItems) {
      const poItem = po.items.find((p) => p.id === grnItem.purchaseOrderItemId);
      if (!poItem) continue;
      const remaining = poItem.quantity - (poItem.receivedQuantity || 0);
      if (grnItem.quantity < remaining && remaining > 0) {
        grnItem.quantity = remaining;
      }
    }
  }

  try {
    const grn = await getGoodsReceiptService().create({
      purchaseOrderId,
      gudangId: purchaseRequest.gudangId,
      receivedById: actorId,
      tenantId,
      fotoBukti,
      notes: `Penerimaan dari Pre Request ${purchaseRequest.nomorRequest}`,
      items: grnItems,
    });

    const updatedPo = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { status: true },
    });

    if (closePO && updatedPo?.status !== "RECEIVED") {
      await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status: "RECEIVED", receivedById: actorId },
      });
    }

    if (updatedPo?.status === "RECEIVED" || closePO) {
      await prisma.purchaseRequest.update({
        where: { id },
        data: { status: "RECEIVED" },
      });
    }

    return NextResponse.json({
      data: grn,
      message: "Barang berhasil diterima dan GRN tercatat",
    });
  } catch (error) {
    if (error instanceof PurchaseOrderNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    if (error instanceof GoodsReceiptInvalidError) {
      return ApiErrors.badRequest(error.message);
    }
    const message =
      error instanceof Error ? error.message : "Gagal memproses penerimaan";
    return ApiErrors.internalError(message);
  }
});
