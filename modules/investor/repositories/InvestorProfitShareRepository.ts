import { prisma } from "@/lib/prisma";
import type { InvestorProfitShareStatus } from "@prisma/client";

export interface CreateProfitShareInput {
  investorId: string;
  configId: string;
  periodStart: Date;
  periodEnd: Date;
  netProfit: number;
  sharePercent: number;
  shareAmount: number;
  tenantId?: string;
  notes?: string;
}

export class InvestorProfitShareRepository {
  /** Membuat record profit share baru. */
  async create(data: CreateProfitShareInput) {
    const record = await prisma.investorProfitShare.create({
      data: {
        investorId: data.investorId,
        configId: data.configId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        netProfit: data.netProfit,
        sharePercent: data.sharePercent,
        shareAmount: data.shareAmount,
        tenantId: data.tenantId,
        notes: data.notes,
      },
    });
    return {
      ...record,
      netProfit: Number(record.netProfit),
      shareAmount: Number(record.shareAmount),
    };
  }

  /** Mengambil profit share berdasarkan ID. */
  async findById(id: string) {
    const record = await prisma.investorProfitShare.findUnique({
      where: { id },
    });
    if (!record) return null;
    return {
      ...record,
      netProfit: Number(record.netProfit),
      shareAmount: Number(record.shareAmount),
    };
  }

  /** Mengambil daftar profit share berdasarkan investor. */
  async listByInvestor(investorId: string) {
    const records = await prisma.investorProfitShare.findMany({
      where: { investorId },
      orderBy: { periodStart: "desc" },
    });
    return records.map((r) => ({
      ...r,
      netProfit: Number(r.netProfit),
      shareAmount: Number(r.shareAmount),
    }));
  }

  /** Mengambil daftar profit share berdasarkan periode. */
  async listByPeriod(tenantId: string, periodStart: Date, periodEnd: Date) {
    const records = await prisma.investorProfitShare.findMany({
      where: { tenantId, periodStart, periodEnd },
      include: {
        investor: { select: { namaLengkap: true, perusahaan: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return records.map((r) => ({
      ...r,
      netProfit: Number(r.netProfit),
      shareAmount: Number(r.shareAmount),
    }));
  }

  /** Update status profit share. */
  async updateStatus(
    id: string,
    data: {
      status?: InvestorProfitShareStatus;
      approvedAt?: Date;
      approvedById?: string;
      paidAt?: Date;
      paidById?: string;
      payoutId?: string;
    },
  ) {
    const record = await prisma.investorProfitShare.update({
      where: { id },
      data,
    });
    return {
      ...record,
      netProfit: Number(record.netProfit),
      shareAmount: Number(record.shareAmount),
    };
  }
}
