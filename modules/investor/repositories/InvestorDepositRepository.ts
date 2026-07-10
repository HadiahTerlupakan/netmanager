import { prisma } from "@/lib/prisma";
import type {
  InvestorDepositStatus,
  InvestorDepositType,
} from "@prisma/client";

export interface CreateDepositInput {
  investorId: string;
  amount: number;
  depositType: InvestorDepositType;
  date: Date;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  reference?: string;
  notes?: string;
  proofFileUrl?: string;
  tenantId?: string;
}

export interface UpdateDepositStatusInput {
  status: InvestorDepositStatus;
  verifiedAt?: Date;
  verifiedById?: string;
  completedAt?: Date;
  rejectedAt?: Date;
  rejectedReason?: string;
  journalId?: string;
}

export class InvestorDepositRepository {
  /** Membuat record deposit investor baru. */
  async create(data: CreateDepositInput) {
    const deposit = await prisma.investorDeposit.create({
      data: {
        investorId: data.investorId,
        amount: data.amount,
        depositType: data.depositType,
        date: data.date,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        reference: data.reference,
        notes: data.notes,
        proofFileUrl: data.proofFileUrl,
        tenantId: data.tenantId,
      },
    });
    return { ...deposit, amount: Number(deposit.amount) };
  }

  /** Mengambil deposit berdasarkan ID. */
  async findById(id: string) {
    const deposit = await prisma.investorDeposit.findUnique({ where: { id } });
    if (!deposit) return null;
    return { ...deposit, amount: Number(deposit.amount) };
  }

  /** Mengambil daftar deposit berdasarkan investor. */
  async listByInvestor(
    investorId: string,
    filter?: { status?: InvestorDepositStatus },
  ) {
    const deposits = await prisma.investorDeposit.findMany({
      where: {
        investorId,
        ...(filter?.status ? { status: filter.status } : {}),
      },
      orderBy: { date: "desc" },
    });
    return deposits.map((d) => ({ ...d, amount: Number(d.amount) }));
  }

  /** Mengambil daftar deposit PENDING untuk tenant. */
  async listPending(tenantId: string) {
    const deposits = await prisma.investorDeposit.findMany({
      where: { tenantId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        investor: { select: { namaLengkap: true, perusahaan: true } },
      },
    });
    return deposits.map((d) => ({ ...d, amount: Number(d.amount) }));
  }

  /** Mengambil semua deposit untuk tenant, opsional filter by status. */
  async listAll(tenantId: string, filter?: { status?: InvestorDepositStatus }) {
    const deposits = await prisma.investorDeposit.findMany({
      where: {
        tenantId,
        ...(filter?.status ? { status: filter.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        investor: { select: { namaLengkap: true, perusahaan: true } },
      },
    });
    return deposits.map((d) => ({ ...d, amount: Number(d.amount) }));
  }

  /** Update status deposit. */
  async updateStatus(id: string, data: UpdateDepositStatusInput) {
    const deposit = await prisma.investorDeposit.update({
      where: { id },
      data,
    });
    return { ...deposit, amount: Number(deposit.amount) };
  }

  /** Menghitung total deposit COMPLETED untuk investor (hanya MODAL_AWAL + TAMBAHAN_MODAL). */
  async sumCompletedByInvestor(investorId: string): Promise<number> {
    const result = await prisma.investorDeposit.aggregate({
      where: {
        investorId,
        status: "COMPLETED",
        depositType: { in: ["MODAL_AWAL", "TAMBAHAN_MODAL"] },
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  /** Menghitung total deposit COMPLETED semua investor dalam tenant. */
  async sumCompletedAll(tenantId: string): Promise<number> {
    const result = await prisma.investorDeposit.aggregate({
      where: {
        tenantId,
        status: "COMPLETED",
        depositType: { in: ["MODAL_AWAL", "TAMBAHAN_MODAL"] },
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }
}
