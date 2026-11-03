import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ApproveSettlementData,
  IResellerSettlementRepository,
  PaySettlementData,
  PaySettlementOutcome,
  SettlementPaymentAccount,
} from "../domain/ports/IResellerSettlementRepository";
import type { ResellerSettlementEntity } from "../domain/entities/ResellerCommissionEntity";

const PENDING_STATUS = "PENDING";
const APPROVED_STATUS = "APPROVED";
const PAID_STATUS = "PAID";
const SETTLED_COMMISSION_STATUS = "SETTLED";

/** Pembatal transaksi bayar bila saldo rekening tidak cukup. */
class InsufficientBalanceSignal extends Error {}

export class ResellerSettlementRepository implements IResellerSettlementRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Settlement milik reseller di tenant (belum dihapus). */
  async findById(
    tenantId: string | null,
    resellerId: string,
    settlementId: string,
  ): Promise<ResellerSettlementEntity | null> {
    return this.db.resellerSettlement.findFirst({
      where: { id: settlementId, tenantId, resellerId, deletedAt: null },
    });
  }

  /** PENDING → APPROVED; null bila status asalnya sudah bukan PENDING. */
  async approve(
    data: ApproveSettlementData,
  ): Promise<ResellerSettlementEntity | null> {
    const claimed = await this.db.resellerSettlement.updateMany({
      where: { id: data.settlementId, status: PENDING_STATUS, deletedAt: null },
      data: {
        status: APPROVED_STATUS,
        approvedAt: data.approvedAt,
        approvedById: data.approvedById,
      },
    });
    if (claimed.count === 0) return null;
    return this.db.resellerSettlement.findFirst({
      where: { id: data.settlementId },
    });
  }

  /**
   * APPROVED → PAID, komisinya SETTLED → PAID, dan saldo rekening Kas & Bank
   * dikurangi total settlement, dalam satu transaksi. Jadi tidak ada settlement
   * PAID dengan komisi yang masih SETTLED, dan saldo rekening tidak berbeda
   * dari jurnal GL-nya (Cr Kas/Bank), sama seperti pembayaran PO.
   *
   * Saldo dijaga dengan `balance >= total` di klausa WHERE, jadi dua
   * pembayaran yang berlomba tidak bisa sama-sama lolos dengan saldo yang
   * hanya cukup untuk satu. Saldo kurang membatalkan seluruh transaksi.
   */
  async markPaid(data: PaySettlementData): Promise<PaySettlementOutcome> {
    try {
      return await this.db.$transaction(async (tx) => {
        const claimed = await tx.resellerSettlement.updateMany({
          where: {
            id: data.settlementId,
            status: APPROVED_STATUS,
            deletedAt: null,
          },
          data: {
            status: PAID_STATUS,
            paidAt: data.paidAt,
            paidById: data.paidById,
            paymentMethod: data.paymentMethod,
            paymentReference: data.paymentReference,
            paymentAccountId: data.paymentAccountId,
          },
        });
        if (claimed.count === 0) return { kind: "status-changed" } as const;

        const settlement = await tx.resellerSettlement.findFirstOrThrow({
          where: { id: data.settlementId },
        });
        const debited = await tx.financialAccount.updateMany({
          where: {
            id: data.paymentAccountId,
            tenantId: data.tenantId,
            isActive: true,
            balance: { gte: settlement.totalAmount },
          },
          data: { balance: { decrement: settlement.totalAmount } },
        });
        if (debited.count === 0) throw new InsufficientBalanceSignal();

        await tx.resellerCommission.updateMany({
          where: {
            settlementId: data.settlementId,
            status: SETTLED_COMMISSION_STATUS,
          },
          data: { status: PAID_STATUS, paidAt: data.paidAt },
        });
        return { kind: "paid", settlement } as const;
      });
    } catch (error) {
      if (error instanceof InsufficientBalanceSignal) {
        return { kind: "insufficient-balance" };
      }
      throw error;
    }
  }

  /** Rekening Kas & Bank aktif milik tenant, urut nama. */
  async listPaymentAccounts(
    tenantId: string | null,
  ): Promise<readonly SettlementPaymentAccount[]> {
    return this.db.financialAccount.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, type: true, balance: true },
      orderBy: { name: "asc" },
    });
  }

  /** Rekening Kas & Bank aktif milik tenant. */
  async paymentAccountExists(
    tenantId: string | null,
    accountId: string,
  ): Promise<boolean> {
    const account = await this.db.financialAccount.findFirst({
      where: { id: accountId, tenantId, isActive: true },
      select: { id: true },
    });
    return account !== null;
  }
}
