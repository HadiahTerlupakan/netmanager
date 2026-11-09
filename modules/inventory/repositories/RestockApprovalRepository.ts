import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/modules/database";

import type {
  IRestockApprovalRepository,
  RestockDecidedRequest,
  RestockRequestForDecision,
  SaveRestockApprovalCommand,
  SaveRestockRejectionCommand,
} from "../domain/ports/IRestockApprovalRepository";
import type {
  RestockApprovalBarangRef,
  RestockBarangLinePlan,
  RestockJasaLinePlan,
} from "../domain/restock-approval-decision";

const UNDECIDED_STATUS = "DRAFT";

/** Dilempar di dalam transaksi agar semua tulisan dibatalkan bila kalah balapan. */
class RestockDecisionRaceLostError extends Error {
  constructor() {
    super("Pengajuan sudah diputuskan atau barisnya berubah");
    this.name = "RestockDecisionRaceLostError";
  }
}

/**
 * Akses data untuk keputusan setuju/tolak pengajuan restock. Setiap keputusan
 * ditulis dalam satu transaksi yang hanya berhasil bila pengajuan masih DRAFT.
 */
export class RestockApprovalRepository implements IRestockApprovalRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Muat pengajuan milik tenant beserta baris barang dan jasanya. */
  async findRequestForDecision(
    purchaseRequestId: string,
    tenantId: string,
  ): Promise<RestockRequestForDecision | null> {
    const record = await this.db.purchaseRequest.findFirst({
      where: { id: purchaseRequestId, tenantId },
      select: {
        id: true,
        nomorRequest: true,
        status: true,
        items: {
          select: {
            id: true,
            barangId: true,
            jumlah: true,
            hargaPerUnit: true,
            barang: { select: { nama: true } },
          },
        },
        jasaItems: {
          select: {
            id: true,
            jumlah: true,
            hargaPerUnit: true,
            jasa: { select: { nama: true } },
          },
        },
      },
    });
    if (!record) return null;

    return {
      id: record.id,
      nomorRequest: record.nomorRequest,
      status: record.status,
      barangLines: record.items.map((item) => ({
        id: item.id,
        barangId: item.barangId,
        barangNama: item.barang?.nama ?? "Barang",
        jumlah: item.jumlah,
        hargaPerUnit: item.hargaPerUnit,
      })),
      jasaLines: record.jasaItems.map((item) => ({
        id: item.id,
        jasaNama: item.jasa?.nama ?? "Jasa",
        jumlah: item.jumlah,
        hargaPerUnit: item.hargaPerUnit,
      })),
    };
  }

  /** Cari barang milik tenant berdasarkan id, untuk calon pengganti. */
  async findBarangByIds(
    barangIds: string[],
    tenantId: string,
  ): Promise<RestockApprovalBarangRef[]> {
    if (barangIds.length === 0) return [];
    return this.db.barang.findMany({
      where: { id: { in: barangIds }, tenantId },
      select: { id: true, nama: true },
    });
  }

  /** Tulis persetujuan dan keputusan per baris dalam satu transaksi. */
  async saveApproval(command: SaveRestockApprovalCommand): Promise<boolean> {
    return this.runDecision(async (tx) => {
      await this.claimUndecidedRequest(tx, command, {
        status: "APPROVED",
        catatanApproval: command.catatan,
      });
      for (const line of command.plan.barangLines) {
        await this.expectOneRow(
          tx.purchaseRequestItem.updateMany({
            where: {
              id: line.itemId,
              purchaseRequestId: command.purchaseRequestId,
            },
            data: toBarangLineData(line),
          }),
        );
      }
      for (const line of command.plan.jasaLines) {
        await this.expectOneRow(
          tx.purchaseRequestJasaItem.updateMany({
            where: {
              id: line.itemId,
              purchaseRequestId: command.purchaseRequestId,
            },
            data: toJasaLineData(line),
          }),
        );
      }
    });
  }

  /** Tulis penolakan seluruh pengajuan; semua baris ikut ditandai ditolak. */
  async saveRejection(command: SaveRestockRejectionCommand): Promise<boolean> {
    return this.runDecision(async (tx) => {
      await this.claimUndecidedRequest(tx, command, {
        status: "REJECTED",
        catatanApproval: command.catatan,
      });
      const lineWhere = { purchaseRequestId: command.purchaseRequestId };
      await tx.purchaseRequestItem.updateMany({
        where: lineWhere,
        data: { statusApproval: "REJECTED" },
      });
      await tx.purchaseRequestJasaItem.updateMany({
        where: lineWhere,
        data: { statusApproval: "REJECTED" },
      });
    });
  }

  /** Ambil pengajuan yang baru diputuskan untuk dikirim balik ke klien. */
  async findDecidedRequest(
    purchaseRequestId: string,
    tenantId: string,
  ): Promise<RestockDecidedRequest | null> {
    return this.db.purchaseRequest.findFirst({
      where: { id: purchaseRequestId, tenantId },
      include: {
        requester: { select: { name: true } },
        approver: { select: { name: true } },
        gudang: { select: { nama: true } },
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
      },
    });
  }

  private async runDecision(
    write: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<boolean> {
    try {
      await this.db.$transaction(write);
      return true;
    } catch (error) {
      if (error instanceof RestockDecisionRaceLostError) return false;
      throw error;
    }
  }

  /** Ubah status hanya bila masih DRAFT, supaya dua penyetuju tidak saling timpa. */
  private async claimUndecidedRequest(
    tx: Prisma.TransactionClient,
    command: SaveRestockRejectionCommand | SaveRestockApprovalCommand,
    decision: {
      status: "APPROVED" | "REJECTED";
      catatanApproval: string | null;
    },
  ): Promise<void> {
    await this.expectOneRow(
      tx.purchaseRequest.updateMany({
        where: {
          id: command.purchaseRequestId,
          tenantId: command.tenantId,
          status: UNDECIDED_STATUS,
        },
        data: {
          ...decision,
          approvedAt: command.decidedAt,
          approvedBy: command.actorId,
        },
      }),
    );
  }

  private async expectOneRow(
    update: Promise<Prisma.BatchPayload>,
  ): Promise<void> {
    const { count } = await update;
    if (count === 0) throw new RestockDecisionRaceLostError();
  }
}

function toBarangLineData(
  line: RestockBarangLinePlan,
): Prisma.PurchaseRequestItemUncheckedUpdateManyInput {
  return {
    statusApproval: line.statusApproval,
    catatanApproval: line.catatanApproval,
    ...(line.quantityChange ?? {}),
    ...(line.substitution
      ? {
          barangId: line.substitution.barangId,
          barangIdDiminta: line.substitution.barangIdDiminta,
        }
      : {}),
  };
}

function toJasaLineData(
  line: RestockJasaLinePlan,
): Prisma.PurchaseRequestJasaItemUncheckedUpdateManyInput {
  return {
    statusApproval: line.statusApproval,
    catatanApproval: line.catatanApproval,
    ...(line.quantityChange ?? {}),
  };
}
