import { randomUUID } from "crypto";
import type { Prisma, PrismaClient, ResellerCommission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ResellerCommissionEntity } from "../domain/entities/ResellerCommissionEntity";
import type {
  IResellerCommissionReversalRepository,
  UnpaidInvoiceReversal,
  UnpaidInvoiceReversalParams,
} from "../domain/ports/IResellerCommissionReversalRepository";
import {
  ADJUSTMENT_WITH_APPLICATIONS,
  planAdjustmentDeduction,
  recordAdjustmentApplications,
  toAdjustmentEntity,
} from "./commission-adjustment-tx";
import {
  lockInvoiceCommission,
  lockResellerAdjustments,
} from "./commission-locks";
import { withNumericRate } from "./commission-rate-mapper";

const ACCRUED_STATUS = "ACCRUED";
const PENDING_STATUS = "PENDING";
const SETTLED_STATUS = "SETTLED";
const PAID_STATUS = "PAID";
const REVERSED_STATUS = "REVERSED";

type Tx = Prisma.TransactionClient;

interface ResellerScope {
  readonly tenantId: string | null;
  readonly resellerId: string;
}

/**
 * Pembalikan komisi invoice yang tidak lagi lunas. Seluruhnya satu transaksi
 * di bawah advisory lock per invoice (sama dengan akru), jadi pembalikan
 * ganda yang berlomba tidak memproses komisi yang sama dua kali.
 *
 * Kunci koreksi reseller diambil untuk SEMUA kandidat sebelum nasibnya
 * diputuskan: pembuatan settlement memegang kunci itu sepanjang transaksinya,
 * jadi settlement yang berjalan bersamaan sudah commit (atau menunggu) saat
 * kandidat dibaca ulang. Tanpa itu, komisi ACCRUED yang baru saja diklaim
 * settlement lolos dari pembatalan tanpa jejak.
 *
 * Urutan kunci: invoice → koreksi reseller → baris settlement → baris komisi.
 * Pembuatan settlement mengunci koreksi reseller lalu baris komisi, dan
 * pembayaran settlement mengunci baris settlement sebelum baris komisinya,
 * jadi tidak ada jalur yang saling mengunci (deadlock).
 */
export class ResellerCommissionReversalRepository implements IResellerCommissionReversalRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Batalkan, keluarkan dari settlement, atau tagih balik komisi invoice. */
  async reverseForUnpaidInvoice(
    params: UnpaidInvoiceReversalParams,
  ): Promise<UnpaidInvoiceReversal> {
    return this.db.$transaction(async (tx) => {
      await lockInvoiceCommission(tx, params.invoiceId);
      const tenantWhere = params.tenantId ? { tenantId: params.tenantId } : {};
      const candidateWhere: Prisma.ResellerCommissionWhereInput = {
        invoiceId: params.invoiceId,
        ...tenantWhere,
        deletedAt: null,
        status: { in: [ACCRUED_STATUS, SETTLED_STATUS, PAID_STATUS] },
      };
      await lockCandidateResellers(tx, candidateWhere);
      const candidates = await tx.resellerCommission.findMany({
        where: candidateWhere,
        orderBy: { id: "asc" },
      });
      const cancelledAt = new Date();
      const cancelled: ResellerCommissionEntity[] = [];
      for (const candidate of candidates) {
        const outcome = await this.reverseOne(tx, candidate, {
          reason: params.reason,
          cancelledAt,
        });
        if (outcome) cancelled.push(outcome);
      }
      const clawbacks = await tx.resellerCommissionAdjustment.findMany({
        where: { invoiceId: params.invoiceId, ...tenantWhere },
        include: ADJUSTMENT_WITH_APPLICATIONS,
        orderBy: { createdAt: "asc" },
      });
      return { cancelled, clawbacks: clawbacks.map(toAdjustmentEntity) };
    });
  }

  /**
   * Null bila komisi tidak dibatalkan (ditagih balik, atau sudah diproses).
   * Kandidat dibaca setelah kunci koreksi reseller diambil, jadi
   * `settlementId`-nya mencerminkan settlement yang sudah commit.
   */
  private async reverseOne(
    tx: Tx,
    candidate: ResellerCommission,
    context: { readonly reason: string; readonly cancelledAt: Date },
  ): Promise<ResellerCommissionEntity | null> {
    if (candidate.settlementId === null) {
      return cancelAccrued(tx, candidate, context.cancelledAt);
    }
    const scope = {
      tenantId: candidate.tenantId,
      resellerId: candidate.resellerId,
    };
    const settlementStatus = await lockSettlementStatus(
      tx,
      candidate.settlementId,
    );
    if (settlementStatus === PAID_STATUS) {
      await clawBack(tx, candidate, context.reason);
      return null;
    }
    return removeFromUnpaidSettlement(
      tx,
      candidate,
      scope,
      context.cancelledAt,
    );
  }
}

/**
 * Ambil kunci koreksi semua reseller pemilik kandidat, berurutan id agar dua
 * pembalikan tidak saling mengunci. Reseller pemilik komisi tidak pernah
 * berubah dan komisi baru untuk invoice ini tertahan kunci invoice, jadi
 * daftar reseller dari bacaan awal ini tetap lengkap.
 */
async function lockCandidateResellers(
  tx: Tx,
  where: Prisma.ResellerCommissionWhereInput,
): Promise<void> {
  const owners = await tx.resellerCommission.findMany({
    where,
    select: { resellerId: true },
    distinct: ["resellerId"],
  });
  const resellerIds = owners.map((owner) => owner.resellerId).sort();
  for (const resellerId of resellerIds) {
    await lockResellerAdjustments(tx, resellerId);
  }
}

/** ACCRUED belum disettle → soft-delete; diklaim bersyarat agar tak ganda. */
async function cancelAccrued(
  tx: Tx,
  candidate: ResellerCommission,
  cancelledAt: Date,
): Promise<ResellerCommissionEntity | null> {
  const claim = await tx.resellerCommission.updateMany({
    where: {
      id: candidate.id,
      status: ACCRUED_STATUS,
      settlementId: null,
      deletedAt: null,
    },
    data: { deletedAt: cancelledAt },
  });
  if (claim.count !== 1) return null;
  return { ...withNumericRate(candidate), deletedAt: cancelledAt };
}

/**
 * Status settlement dengan row lock, supaya pembayaran settlement yang
 * berjalan bersamaan selesai dulu (atau menunggu) sebelum kita memutuskan
 * antara mengeluarkan komisi atau menagihnya balik.
 */
async function lockSettlementStatus(
  tx: Tx,
  settlementId: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<{ status: string }[]>`
    SELECT "status"::text AS "status" FROM "ResellerSettlement"
    WHERE "id" = ${settlementId} FOR UPDATE`;
  return rows[0]?.status ?? null;
}

/**
 * Komisi di settlement yang sudah dibayar → REVERSED + koreksi, satu koreksi
 * per akrual (komisi + `accruedAt`). `createMany` dengan `skipDuplicates`
 * (ON CONFLICT DO NOTHING) karena galat unique di dalam transaksi interaktif
 * membatalkan seluruh transaksinya.
 */
async function clawBack(
  tx: Tx,
  candidate: ResellerCommission,
  reason: string,
): Promise<void> {
  const claim = await tx.resellerCommission.updateMany({
    where: {
      id: candidate.id,
      deletedAt: null,
      status: { in: [SETTLED_STATUS, PAID_STATUS] },
    },
    data: { status: REVERSED_STATUS },
  });
  if (claim.count !== 1) return;
  await tx.resellerCommissionAdjustment.createMany({
    data: [
      {
        id: randomUUID(),
        tenantId: candidate.tenantId,
        resellerId: candidate.resellerId,
        pelangganId: candidate.pelangganId,
        invoiceId: candidate.invoiceId,
        sourceCommissionId: candidate.id,
        sourceAccruedAt: candidate.accruedAt,
        amount: candidate.commissionAmount,
        reason,
      },
    ],
    skipDuplicates: true,
  });
}

/**
 * Keluarkan komisi dari settlement PENDING/APPROVED: kembali ACCRUED tanpa
 * settlement lalu dibatalkan, sehingga pulih seperti komisi ACCRUED biasa
 * bila invoice lunas lagi. Total settlement dihitung ulang.
 */
async function removeFromUnpaidSettlement(
  tx: Tx,
  candidate: ResellerCommission,
  scope: ResellerScope,
  cancelledAt: Date,
): Promise<ResellerCommissionEntity | null> {
  const settlementId = candidate.settlementId;
  if (settlementId === null) return null;
  const claim = await tx.resellerCommission.updateMany({
    where: {
      id: candidate.id,
      settlementId,
      status: SETTLED_STATUS,
      deletedAt: null,
    },
    data: {
      status: ACCRUED_STATUS,
      settlementId: null,
      settledAt: null,
      deletedAt: cancelledAt,
    },
  });
  if (claim.count !== 1) return null;
  await recomputeUnpaidSettlement(tx, settlementId, scope, cancelledAt);
  return {
    ...withNumericRate(candidate),
    status: ACCRUED_STATUS,
    settlementId: null,
    settledAt: null,
    deletedAt: cancelledAt,
  };
}

/**
 * Hitung ulang settlement yang komisinya berkurang. Potongan koreksi dihitung
 * ulang dari awal (bisa mengecil bila komisi brutonya kini lebih kecil;
 * sisanya kembali terbuka untuk settlement berikutnya).
 *
 * Settlement yang tidak lagi berisi komisi dibatalkan (soft-delete): tidak
 * ada yang perlu disetujui atau dibayar, dan koreksi yang sempat
 * dipotongkannya kembali terbuka.
 *
 * Settlement APPROVED dikembalikan ke PENDING (persetujuan dihapus):
 * nominal dan potongan barunya, termasuk koreksi yang terbit setelah
 * persetujuan, wajib disetujui ulang sebelum dibayar.
 */
async function recomputeUnpaidSettlement(
  tx: Tx,
  settlementId: string,
  scope: ResellerScope,
  now: Date,
): Promise<void> {
  const remaining = await tx.resellerCommission.findMany({
    where: { settlementId, deletedAt: null },
    select: { commissionAmount: true },
  });
  await tx.resellerCommissionAdjustmentApplication.deleteMany({
    where: { settlementId },
  });
  if (remaining.length === 0) {
    await tx.resellerSettlement.updateMany({
      where: { id: settlementId },
      data: {
        totalAmount: 0,
        adjustmentAmount: 0,
        commissionCount: 0,
        deletedAt: now,
      },
    });
    return;
  }
  const grossAmount = remaining.reduce(
    (total, commission) => total + commission.commissionAmount,
    0,
  );
  const deduction = await planAdjustmentDeduction(tx, scope, grossAmount);
  await recordAdjustmentApplications(
    tx,
    { tenantId: scope.tenantId, settlementId },
    deduction.allocations,
  );
  await tx.resellerSettlement.updateMany({
    where: { id: settlementId },
    data: {
      totalAmount: grossAmount - deduction.deductedAmount,
      adjustmentAmount: deduction.deductedAmount,
      commissionCount: remaining.length,
      status: PENDING_STATUS,
      approvedAt: null,
      approvedById: null,
    },
  });
}
