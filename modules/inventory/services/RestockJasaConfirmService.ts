import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";

export interface ConfirmJasaItemInput {
  jasaItemId: string;
  tanggalSelesai?: string | null;
  buktiSelesai?: string[];
}

export interface ConfirmRestockJasaInput {
  purchaseRequestId: string;
  items: ConfirmJasaItemInput[];
  actorId: string;
  tenantId: string;
}

/** Konfirmasi penyelesaian item jasa pada purchase request restock. */
export async function confirmRestockJasaItems(input: ConfirmRestockJasaInput) {
  try {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      return NextResponse.json(
        { error: "Minimal 1 item jasa harus dikonfirmasi" },
        { status: 400 },
      );
    }

    const purchaseRequest = await prisma.purchaseRequest.findFirst({
      where: { id: input.purchaseRequestId, tenantId: input.tenantId },
      include: {
        jasaItems: true,
        items: true,
      },
    });

    if (!purchaseRequest) {
      return NextResponse.json(
        { error: "Purchase Request tidak ditemukan" },
        { status: 404 },
      );
    }

    if (!["APPROVED", "ORDERED", "RECEIVED"].includes(purchaseRequest.status)) {
      return NextResponse.json(
        {
          error:
            "Jasa hanya bisa dikonfirmasi setelah pengajuan di-approve / di-order",
        },
        { status: 400 },
      );
    }

    const allowedIds = new Set(
      purchaseRequest.jasaItems.map((item) => item.id),
    );
    for (const item of input.items) {
      if (!allowedIds.has(item.jasaItemId)) {
        return NextResponse.json(
          { error: `Item jasa ${item.jasaItemId} tidak valid` },
          { status: 400 },
        );
      }
      if (!item.buktiSelesai || item.buktiSelesai.length === 0) {
        return NextResponse.json(
          { error: "Bukti penyelesaian wajib diunggah untuk setiap item jasa" },
          { status: 400 },
        );
      }
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        await tx.purchaseRequestJasaItem.update({
          where: { id: item.jasaItemId },
          data: {
            statusKonfirmasi: "SELESAI",
            tanggalSelesai: item.tanggalSelesai
              ? new Date(item.tanggalSelesai)
              : now,
            buktiSelesai: item.buktiSelesai ?? [],
            confirmedAt: now,
            confirmedBy: input.actorId,
          },
        });
      }

      const remainingPending = await tx.purchaseRequestJasaItem.count({
        where: {
          purchaseRequestId: input.purchaseRequestId,
          statusKonfirmasi: "PENDING",
        },
      });

      // Hanya auto-RECEIVED jika tidak ada item barang, dan semua jasa selesai.
      const hasBarangItems = purchaseRequest.items.length > 0;
      if (remainingPending === 0 && !hasBarangItems) {
        await tx.purchaseRequest.update({
          where: { id: input.purchaseRequestId },
          data: { status: "RECEIVED" },
        });
      }
    });

    const updated = await prisma.purchaseRequest.findFirst({
      where: { id: input.purchaseRequestId },
      include: {
        requester: { select: { name: true, email: true } },
        gudang: { select: { nama: true, kode: true } },
        items: {
          include: {
            barang: { select: { nama: true, kode: true, satuan: true } },
          },
        },
        jasaItems: {
          include: {
            jasa: {
              select: {
                id: true,
                kode: true,
                nama: true,
                satuan: true,
                hargaEstimasi: true,
              },
            },
          },
        },
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
      },
    });

    await logger.logActivity({
      action: "CONFIRM_JASA",
      subject: "PurchaseRequest",
      userId: input.actorId,
      details: {
        purchaseRequestId: input.purchaseRequestId,
        confirmedCount: input.items.length,
      },
    });

    return NextResponse.json({
      data: updated,
      message: "Jasa berhasil dikonfirmasi selesai",
    });
  } catch (error: unknown) {
    const err =
      error instanceof Error ? error : new Error("Terjadi kesalahan server");
    logger.error("Error confirming restock jasa", err, {
      purchaseRequestId: input.purchaseRequestId,
    });
    return NextResponse.json(
      { error: "Gagal mengonfirmasi penyelesaian jasa" },
      { status: 500 },
    );
  }
}
