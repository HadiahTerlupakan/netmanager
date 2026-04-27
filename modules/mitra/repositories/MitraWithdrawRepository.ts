import { prismaMitra } from "@/lib/prisma-mitra";
import {
  MitraTransactionType,
  Prisma,
  WithdrawStatus,
} from "@prisma/client-mitra";
import type {
  CreateWithdrawRequestRecord,
  IMitraWithdrawRepository,
  MobileWithdrawHistoryQuery,
  UpdateWithdrawStatusRecord,
  WithdrawRequestFilter,
} from "../domain/ports/IMitraWithdrawRepository";
import type { WithdrawRequestEntity } from "../domain/entities/WithdrawRequestEntity";
import { toWithdrawRequestEntity } from "../mappers/MitraDomainMapper";

const ACTIVE_WITHDRAW_STATUSES = [
  WithdrawStatus.PENDING,
  WithdrawStatus.APPROVED,
  WithdrawStatus.PROCESSING,
] as const;
const MOBILE_WITHDRAW_ORDER = { createdAt: "desc" } as const;

export class MitraWithdrawRepository implements IMitraWithdrawRepository {
  /** Mengambil mitra untuk validasi penarikan. */
  async findMitraById(userId: string, tenantId?: string) {
    return prismaMitra.mitra.findFirst({
      where: { id: userId, ...(tenantId && { tenantId }) },
      select: { id: true, minWithdrawal: true },
    });
  }

  /** Mengambil wallet mitra. */
  async findWalletByMitraId(mitraId: string, tenantId?: string) {
    const wallet = await prismaMitra.mitraWallet.findFirst({
      where: { mitraId, ...(tenantId && { mitra: { tenantId } }) },
      select: { id: true, balance: true },
    });
    if (!wallet) return null;

    return { id: wallet.id, balance: wallet.balance.toNumber() };
  }

  /** Menghitung request penarikan yang masih aktif. */
  async countPendingWithdrawals(walletId: string) {
    return prismaMitra.withdrawRequest.count({
      where: {
        mitraWalletId: walletId,
        status: { in: [...ACTIVE_WITHDRAW_STATUSES] },
      },
    });
  }

  /** Membuat request penarikan baru. */
  async createWithdrawRequest(record: CreateWithdrawRequestRecord) {
    await prismaMitra.withdrawRequest.create({
      data: this.buildWithdrawCreateData(record),
    });
  }

  /** Mengambil request penarikan lengkap berdasarkan id. */
  async findWithdrawRequestById(id: string, tenantId?: string) {
    const request = await prismaMitra.withdrawRequest.findFirst({
      where: { id, ...(tenantId && { mitra: { tenantId } }) },
      include: {
        mitraWallet: {
          include: {
            mitra: {
              select: { id: true, name: true, email: true, mitraType: true },
            },
          },
        },
      },
    });

    return request ? toWithdrawRequestEntity(request) : null;
  }

  /** Mengambil request penarikan sederhana berdasarkan id. */
  async findWithdrawRequestByIdSimple(id: string, tenantId?: string) {
    const request = await prismaMitra.withdrawRequest.findFirst({
      where: { id, ...(tenantId && { mitra: { tenantId } }) },
    });

    return request ? toWithdrawRequestEntity(request) : null;
  }

  /** Memperbarui status request penarikan. */
  async updateWithdrawStatus(record: UpdateWithdrawStatusRecord) {
    await prismaMitra.withdrawRequest.update({
      where: { id: record.id },
      data: {
        status: record.status as WithdrawStatus,
        rejectionReason: record.rejectionReason,
        processedById: record.processedById,
        processedAt: record.processedAt,
      },
    });
  }

  /** Mengambil daftar request penarikan dengan filter. */
  async findWithdrawRequests(filter: WithdrawRequestFilter) {
    const skip = (filter.page - 1) * filter.limit;
    const where = this.buildWithdrawWhere(filter);
    const [requests, total] = await Promise.all([
      prismaMitra.withdrawRequest.findMany({
        where,
        include: {
          mitraWallet: {
            include: {
              mitra: {
                select: { id: true, name: true, email: true, mitraType: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: filter.limit,
      }),
      prismaMitra.withdrawRequest.count({ where }),
    ]);

    return {
      requests: requests.map(toWithdrawRequestEntity),
      total,
      page: filter.page,
      totalPages: Math.ceil(total / filter.limit),
    };
  }

  /** Menyelesaikan penarikan dan mutasi wallet secara atomik. */
  async completeWithdraw(params: {
    walletId: string;
    amount: number;
    requestId: string;
    method: string;
    processedById: string;
  }) {
    await prismaMitra.$transaction(async (tx) => {
      await tx.mitraWallet.update({
        where: { id: params.walletId },
        data: {
          balance: { decrement: params.amount },
          totalWithdrawn: { increment: params.amount },
        },
      });
      await tx.mitraTransaction.create({
        data: this.buildWithdrawTransactionData(params),
      });
      await tx.withdrawRequest.update({
        where: { id: params.requestId },
        data: {
          status: WithdrawStatus.COMPLETED,
          processedById: params.processedById,
          processedAt: new Date(),
        },
      });
    });
  }

  /** Mengambil riwayat penarikan mobile beserta info bank mitra. */
  async getMobileWithdrawHistory(query: MobileWithdrawHistoryQuery) {
    const mitra = await prismaMitra.mitra.findFirst({
      where: {
        id: query.mitraId,
        ...(query.tenantId && { tenantId: query.tenantId }),
      },
      select: {
        id: true,
        bankName: true,
        bankAccountNo: true,
        bankAccountName: true,
      },
    });
    if (!mitra) return null;
    const wallet = await prismaMitra.mitraWallet.findFirst({
      where: {
        mitraId: mitra.id,
        ...(query.tenantId && { mitra: { tenantId: query.tenantId } }),
      },
    });
    if (!wallet) return this.buildEmptyMobileWithdrawHistory(mitra);
    const skip = (query.page - 1) * query.limit;
    const [withdrawals, total] = await Promise.all([
      prismaMitra.withdrawRequest.findMany({
        where: { mitraWalletId: wallet.id },
        orderBy: MOBILE_WITHDRAW_ORDER,
        skip,
        take: query.limit,
      }),
      prismaMitra.withdrawRequest.count({
        where: { mitraWalletId: wallet.id },
      }),
    ]);

    return {
      bankInfo: this.buildMobileBankInfo(mitra),
      withdrawals: withdrawals.map(toWithdrawRequestEntity),
      total,
    };
  }

  private buildWithdrawCreateData(
    record: CreateWithdrawRequestRecord,
  ): Prisma.WithdrawRequestCreateInput {
    return {
      id: record.id,
      mitra: { connect: { id: record.userId } },
      mitraWallet: { connect: { id: record.walletId } },
      amount: record.payload.amount,
      method: record.payload.method,
      bankName: record.payload.bankName,
      bankAccountNo: record.payload.accountNumber,
      bankAccountName: record.payload.accountName,
      notes: record.payload.notes,
    };
  }

  private buildEmptyMobileWithdrawHistory(mitra: {
    bankName: string | null;
    bankAccountNo: string | null;
    bankAccountName: string | null;
  }) {
    return {
      bankInfo: this.buildMobileBankInfo(mitra),
      withdrawals: [] as WithdrawRequestEntity[],
      total: 0,
    };
  }

  private buildMobileBankInfo(mitra: {
    bankName: string | null;
    bankAccountNo: string | null;
    bankAccountName: string | null;
  }) {
    return {
      bankName: mitra.bankName,
      accountNo: mitra.bankAccountNo,
      accountName: mitra.bankAccountName,
    };
  }

  private buildWithdrawWhere(
    filter: WithdrawRequestFilter,
  ): Prisma.WithdrawRequestWhereInput {
    return {
      ...(filter.userId && { mitraId: filter.userId }),
      ...(filter.status && { status: filter.status as WithdrawStatus }),
      ...(filter.tenantId && { mitra: { tenantId: filter.tenantId } }),
    };
  }

  private buildWithdrawTransactionData(params: {
    walletId: string;
    amount: number;
    requestId: string;
    method: string;
  }) {
    return {
      walletId: params.walletId,
      amount: -params.amount,
      type: MitraTransactionType.WITHDRAW,
      description: `Penarikan via ${params.method === "TRANSFER" ? "Transfer Bank" : "Cash"}`,
      referenceId: params.requestId,
      referenceType: "WITHDRAW",
    };
  }
}

let instance: IMitraWithdrawRepository | null = null;

export function getMitraWithdrawRepository(): IMitraWithdrawRepository {
  if (!instance) {
    instance = new MitraWithdrawRepository();
  }

  return instance;
}
