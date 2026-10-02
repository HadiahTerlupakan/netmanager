import { prisma } from "@/lib/prisma";
import {
  findRabProjectsForProfitShare,
  type RabProjectForProfitShare,
} from "@/modules/finance/public-queries";
import type {
  InvestorProfitShareStatus,
  Prisma,
  RabStatus,
} from "@prisma/client";

import { STATUS_PROYEK_TERLIHAT_INVESTOR } from "../domain/porsi-investor-proyek";

export interface CreateProfitShareInput {
  investorId: string;
  /** Hanya bagi hasil lama berbasis setoran. */
  configId?: string | null;
  /** Proyek RAB sumber bagi hasil per proyek. */
  rabProjectId?: string | null;
  /** Bulan ke-n proyek yang tercakup. */
  projectMonths?: number[];
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

/** Proyek RAB (dari finance) lengkap dengan status aktif tiap investornya. */
export type ProyekUntukBagiHasil = Omit<
  RabProjectForProfitShare,
  "investors"
> & {
  investors: Array<
    RabProjectForProfitShare["investors"][number] & {
      investor: { isActive: boolean };
    }
  >;
};

export class InvestorProfitShareRepository {
  /** Membuat record profit share baru. */
  async create(data: CreateProfitShareInput) {
    return prisma.$transaction(async (tx) => {
      const record = await tx.investorProfitShare.create({
        data: {
          investorId: data.investorId,
          configId: data.configId ?? null,
          rabProjectId: data.rabProjectId ?? null,
          projectMonths: data.projectMonths ?? [],
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
      // Penjaga unique (investor, proyek, bulan): kalkulasi bersamaan yang membagikan
      // bulan yang sama gagal P2002 dan seluruh transaksi dibatalkan.
      if (data.rabProjectId && data.projectMonths?.length) {
        await tx.investorProfitShareBulan.createMany({
          data: data.projectMonths.map((month) => ({
            profitShareId: record.id,
            investorId: data.investorId,
            rabProjectId: data.rabProjectId as string,
            month,
            tenantId: data.tenantId,
          })),
        });
      }
      return keDto(record);
    });
  }

  /** Batalkan bagi hasil dan lepas bulan-bulannya agar bisa dihitung ulang (satu transaksi). */
  async batalkan(id: string, tenantId: string) {
    return prisma.$transaction(async (tx) => {
      const record = await tx.investorProfitShare.update({
        where: { id, tenantId },
        data: { status: "CANCELLED" },
        include: NAMA_PROYEK,
      });
      await tx.investorProfitShareBulan.deleteMany({
        where: { profitShareId: id, tenantId },
      });
      return keDto(record);
    });
  }

  /** Mengambil profit share berdasarkan ID, disaring tenant secara eksplisit. */
  async findById(id: string, tenantId: string) {
    const record = await prisma.investorProfitShare.findFirst({
      where: { id, tenantId },
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

  /**
   * Bulan ke-n proyek yang sudah pernah dibagikan (selain yang dibatalkan),
   * per investor — satu query untuk semua investor proyek. Investor tanpa
   * riwayat tidak muncul di map.
   */
  async findPaidProjectMonthsByInvestor(
    rabProjectId: string,
    investorIds: string[],
  ): Promise<Map<string, Set<number>>> {
    const bulanPerInvestor = new Map<string, Set<number>>();
    if (investorIds.length === 0) return bulanPerInvestor;

    const records = await prisma.investorProfitShare.findMany({
      where: {
        rabProjectId,
        investorId: { in: investorIds },
        status: { not: "CANCELLED" },
      },
      select: { investorId: true, projectMonths: true },
    });
    for (const record of records) {
      const bulan =
        bulanPerInvestor.get(record.investorId) ?? new Set<number>();
      record.projectMonths.forEach((bulanKe) => bulan.add(bulanKe));
      bulanPerInvestor.set(record.investorId, bulan);
    }
    return bulanPerInvestor;
  }

  /**
   * Proyek RAB tenant yang sudah disetujui dan punya investor. Data RAB dibaca
   * lewat public query finance; status aktif investor dari tabel investor sendiri.
   */
  async findProjectsForProfitShare(
    tenantId: string,
  ): Promise<ProyekUntukBagiHasil[]> {
    const proyekList = await findRabProjectsForProfitShare(tenantId, [
      ...STATUS_PROYEK_TERLIHAT_INVESTOR,
    ] as RabStatus[]);
    const investorAktif = await this.findActiveInvestorIds(
      proyekList.flatMap((proyek) =>
        proyek.investors.map((anggota) => anggota.investorId),
      ),
    );
    return proyekList.map((proyek) => ({
      ...proyek,
      investors: proyek.investors.map((anggota) => ({
        ...anggota,
        investor: { isActive: investorAktif.has(anggota.investorId) },
      })),
    }));
  }

  private async findActiveInvestorIds(
    investorIds: string[],
  ): Promise<Set<string>> {
    if (investorIds.length === 0) return new Set();
    const investors = await prisma.investor.findMany({
      where: { id: { in: [...new Set(investorIds)] }, isActive: true },
      select: { id: true },
    });
    return new Set(investors.map((investor) => investor.id));
  }

  /** Update status profit share, disaring tenant secara eksplisit. */
  async updateStatus(
    id: string,
    tenantId: string,
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
      where: { id, tenantId },
      data,
      include: NAMA_PROYEK,
    });
    return keDto(record);
  }
}
