import { prisma } from "@/lib/prisma";
import type { InvestorProfitShareStatus, Prisma, RabStatus } from "@prisma/client";

import { STATUS_PROYEK_TERLIHAT_INVESTOR } from "../domain/porsi-investor-proyek";

export interface CreateProfitShareInput {
  investorId: string;
  /** Hanya bagi hasil lama berbasis setoran. */
  configId?: string | null;
  /** Proyek RAB sumber bagi hasil per proyek. */
  rabProjectId?: string | null;
  periodStart: Date;
  periodEnd: Date;
  netProfit: number;
  sharePercent: number;
  shareAmount: number;
  capitalReturnAmount?: number;
  tenantId?: string;
  notes?: string;
}

/** Nama proyek ikut dimuat agar admin & investor tahu asal bagi hasil. */
const NAMA_PROYEK = { rabProject: { select: { name: true } } } as const;

const NAMA_INVESTOR_DAN_PROYEK = {
  investor: { select: { namaLengkap: true, perusahaan: true } },
  ...NAMA_PROYEK,
} as const;

type RecordBagiHasil = Prisma.InvestorProfitShareGetPayload<object> & {
  rabProject?: { name: string } | null;
};

/** Decimal → number dan nama proyek datar untuk DTO. */
function keDto<T extends RecordBagiHasil>(record: T) {
  return {
    ...record,
    netProfit: Number(record.netProfit),
    shareAmount: Number(record.shareAmount),
    capitalReturnAmount: Number(record.capitalReturnAmount),
    projectName: record.rabProject?.name ?? null,
  };
}

/** Data proyek RAB lengkap untuk menghitung bagi hasil per proyek. */
const PROYEK_UNTUK_BAGI_HASIL = {
  items: { select: { totalPrice: true, expenseType: true } },
  actualAchievements: true,
  investors: {
    select: {
      investorId: true,
      investmentAmount: true,
      investor: { select: { isActive: true } },
    },
  },
} satisfies Prisma.RabProjectInclude;

export type ProyekUntukBagiHasil = Prisma.RabProjectGetPayload<{
  include: typeof PROYEK_UNTUK_BAGI_HASIL;
}>;

export class InvestorProfitShareRepository {
  /** Membuat record profit share baru. */
  async create(data: CreateProfitShareInput) {
    const record = await prisma.investorProfitShare.create({
      data: {
        investorId: data.investorId,
        configId: data.configId ?? null,
        rabProjectId: data.rabProjectId ?? null,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        netProfit: data.netProfit,
        sharePercent: data.sharePercent,
        shareAmount: data.shareAmount,
        capitalReturnAmount: data.capitalReturnAmount ?? 0,
        tenantId: data.tenantId,
        notes: data.notes,
      },
      include: NAMA_PROYEK,
    });
    return keDto(record);
  }

  /** Mengambil profit share berdasarkan ID. */
  async findById(id: string) {
    const record = await prisma.investorProfitShare.findUnique({
      where: { id },
      include: NAMA_PROYEK,
    });
    return record ? keDto(record) : null;
  }

  /** Mengambil daftar profit share berdasarkan investor. */
  async listByInvestor(investorId: string) {
    const records = await prisma.investorProfitShare.findMany({
      where: { investorId },
      include: NAMA_PROYEK,
      orderBy: { periodStart: "desc" },
    });
    return records.map(keDto);
  }

  /** Mengambil daftar profit share berdasarkan periode. */
  async listByPeriod(tenantId: string, periodStart: Date, periodEnd: Date) {
    const records = await prisma.investorProfitShare.findMany({
      where: { tenantId, periodStart, periodEnd },
      include: NAMA_INVESTOR_DAN_PROYEK,
      orderBy: { createdAt: "desc" },
    });
    return records.map(keDto);
  }

  /** Mengambil semua profit share untuk tenant, opsional filter by status. */
  async listAll(
    tenantId: string,
    filter?: { status?: InvestorProfitShareStatus },
  ) {
    const records = await prisma.investorProfitShare.findMany({
      where: {
        tenantId,
        ...(filter?.status ? { status: filter.status } : {}),
      },
      include: NAMA_INVESTOR_DAN_PROYEK,
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
    });
    return records.map(keDto);
  }

  /** Cek apakah sudah ada profit share untuk investor+periode (untuk cegah duplikasi kalkulasi). */
  async existsForInvestorPeriod(
    investorId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<boolean> {
    const record = await prisma.investorProfitShare.findFirst({
      where: { investorId, periodStart, periodEnd },
      select: { id: true },
    });
    return record !== null;
  }

  /** Cek bagi hasil investor untuk proyek+periode sudah dihitung (cegah ganda). */
  async existsForInvestorProjectPeriod(
    investorId: string,
    rabProjectId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<boolean> {
    const record = await prisma.investorProfitShare.findFirst({
      where: { investorId, rabProjectId, periodStart, periodEnd },
      select: { id: true },
    });
    return record !== null;
  }

  /** Proyek RAB tenant yang sudah disetujui dan punya investor. */
  async findProjectsForProfitShare(tenantId: string): Promise<ProyekUntukBagiHasil[]> {
    return prisma.rabProject.findMany({
      where: {
        tenantId,
        status: { in: [...STATUS_PROYEK_TERLIHAT_INVESTOR] as RabStatus[] },
        investors: { some: {} },
      },
      include: PROYEK_UNTUK_BAGI_HASIL,
      orderBy: { createdAt: "asc" },
    });
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
      include: NAMA_PROYEK,
    });
    return keDto(record);
  }
}
