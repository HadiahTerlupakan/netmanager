import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";

import {
  RESTOCK_MESSAGES,
  describeRestockStatus,
  restockServerErrorMessage,
} from "./restock-messages";

const JASA_CONFIRMABLE_STATUSES = ["APPROVED", "ORDERED", "RECEIVED"];

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
        {
          error:
            "Belum ada jasa yang dicentang. Centang jasa yang sudah selesai, lalu simpan.",
        },
        { status: 400 },
      );
    }

    const purchaseRequest = await prisma.purchaseRequest.findFirst({
      where: { id: input.purchaseRequestId, tenantId: input.tenantId },
      include: {
        jasaItems: { include: { jasa: { select: { nama: true } } } },
        items: true,
      },
    });

    if (!purchaseRequest) {
      return NextResponse.json(
        { error: RESTOCK_MESSAGES.requestNotFound },
        { status: 404 },
      );
    }

    if (!JASA_CONFIRMABLE_STATUSES.includes(purchaseRequest.status)) {
      return NextResponse.json(
        {
          error: `Pengajuan ini ${describeRestockStatus(purchaseRequest.status)}. Jasa baru bisa ditandai selesai setelah pengajuannya disetujui.`,
        },
        { status: 400 },
      );
    }

    const problem = findJasaConfirmationProblem(
      input.items,
      purchaseRequest.jasaItems,
    );
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
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
    // Semua tanda selesai ditulis dalam satu transaksi.
    return NextResponse.json(
      { error: restockServerErrorMessage("Menandai jasa selesai", true) },
      { status: 500 },
    );
  }
}

/**
 * Periksa jasa yang mau ditandai selesai. Semua masalah dilaporkan sekaligus,
 * menyebut nama jasanya, satu masalah per baris.
 */
function findJasaConfirmationProblem(
  items: ConfirmJasaItemInput[],
  requestJasaItems: Array<{ id: string; jasa?: { nama: string } | null }>,
): string | null {
  const jasaNameById = new Map(
    requestJasaItems.map((item) => [item.id, item.jasa?.nama ?? "Jasa ini"]),
  );
  const problems: string[] = [];

  for (const item of items) {
    const jasaName = jasaNameById.get(item.jasaItemId);
    if (!jasaName) {
      problems.push(
        "Ada jasa yang tidak termasuk pengajuan ini. Muat ulang halaman, lalu coba lagi.",
      );
      continue;
    }
    if (!item.buktiSelesai || item.buktiSelesai.length === 0) {
      problems.push(
        `${jasaName}: foto bukti jasa selesai belum diunggah. Unggah fotonya dulu.`,
      );
    }
  }

  const uniqueProblems = [...new Set(problems)];
  return uniqueProblems.length > 0 ? uniqueProblems.join("\n") : null;
}
