import { logger } from "@/lib/logger";
import { buildRABTrackingDataset } from "@/modules/finance/client";
import type { InvestorProfitShareStatus } from "@prisma/client";

import {
  bagianInvestor,
  bulatkanRupiah,
  ringkasPeriodeProyek,
} from "../domain/bagi-hasil-proyek";
import { hitungPorsiModal } from "../domain/porsi-investor-proyek";
import {
  InvestorProfitShareRepository,
  type ProyekUntukBagiHasil,
} from "../repositories/InvestorProfitShareRepository";
import { keCapaianTracking, keInputTracking } from "./rab-tracking-input";

/** Proyek yang tidak menghasilkan bagi hasil pada periode, beserta alasannya. */
export interface ProyekDilewati {
  rabProjectId: string;
  namaProyek: string;
  alasan: string;
}

const ALASAN_TANPA_TANGGAL_MULAI = "Tanggal mulai proyek belum diisi di RAB";
const ALASAN_TANPA_CAPAIAN = "Belum ada capaian bulanan (aktual) di periode ini";

export class InvestorProfitShareService {
  constructor(
    private readonly profitShareRepo: InvestorProfitShareRepository = new InvestorProfitShareRepository(),
  ) {}

  /**
   * Hitung bagi hasil investor PER PROYEK untuk periode kalender.
   *
   * Per proyek RAB yang sudah disetujui: ambil baris tracking RAB (mesin yang
   * sama dengan halaman admin RAB) untuk bulan yang punya capaian aktual di
   * periode; bagian investor (bagi hasil + pengembalian modal) dibagi ke tiap
   * investor sesuai porsi modalnya. Investor+proyek+periode yang sudah
   * dihitung dilewati (aman diulang).
   */
  async calculateForPeriod(tenantId: string, periodStart: Date, periodEnd: Date) {
    const proyekList = await this.profitShareRepo.findProjectsForProfitShare(tenantId);
    const dibuat: Awaited<ReturnType<InvestorProfitShareRepository["create"]>>[] = [];
    const dilewati: ProyekDilewati[] = [];

    for (const proyek of proyekList) {
      const hasil = await this.hitungProyek(proyek, tenantId, periodStart, periodEnd);
      if ("alasan" in hasil) dilewati.push(hasil);
      else dibuat.push(...hasil.dibuat);
    }
    return { dibuat, dilewati };
  }

  private async hitungProyek(
    proyek: ProyekUntukBagiHasil,
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<ProyekDilewati | { dibuat: Awaited<ReturnType<InvestorProfitShareRepository["create"]>>[] }> {
    const lewati = (alasan: string): ProyekDilewati => ({
      rabProjectId: proyek.id,
      namaProyek: proyek.name,
      alasan,
    });
    if (!proyek.startDate) return lewati(ALASAN_TANPA_TANGGAL_MULAI);

    const { rows } = buildRABTrackingDataset(keInputTracking(proyek), keCapaianTracking(proyek));
    const ringkasan = ringkasPeriodeProyek(rows, proyek.startDate, periodStart, periodEnd);
    if (ringkasan.jumlahBulan === 0) return lewati(ALASAN_TANPA_CAPAIAN);

    const semuaModal = proyek.investors.map((investor) => investor.investmentAmount);
    const dibuat = [];
    for (const anggota of proyek.investors) {
      if (!anggota.investor.isActive) continue;
      const sudahAda = await this.profitShareRepo.existsForInvestorProjectPeriod(
        anggota.investorId,
        proyek.id,
        periodStart,
        periodEnd,
      );
      if (sudahAda) continue;

      const bagian = bagianInvestor(
        ringkasan,
        hitungPorsiModal(anggota.investmentAmount, semuaModal),
      );
      dibuat.push(
        await this.profitShareRepo.create({
          investorId: anggota.investorId,
          rabProjectId: proyek.id,
          periodStart,
          periodEnd,
          netProfit: bulatkanRupiah(ringkasan.labaBersih),
          sharePercent: bagian.persenDariLaba,
          shareAmount: bagian.bagiHasil,
          capitalReturnAmount: bagian.pengembalianModal,
          tenantId,
        }),
      );
    }
    return { dibuat };
  }

  /** Approve profit share: CALCULATED → APPROVED, publish event untuk notifikasi investor. */
  async approve(id: string, approvedById: string) {
    const record = await this.profitShareRepo.findById(id);
    if (!record) throw new Error("Profit share tidak ditemukan");
    if (record.status !== "CALCULATED") {
      throw new Error(
        `Profit share tidak bisa di-approve, status: ${record.status}`,
      );
    }

    const approvedAt = new Date();
    const approved = await this.profitShareRepo.updateStatus(id, {
      status: "APPROVED",
      approvedAt,
      approvedById,
    });

    // Investor diberi tahu bagi hasilnya siap dibayar.
    const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
    await eventBus
      .publish(EVENT_NAMES.INVESTOR_PROFIT_SHARE_APPROVED, {
        profitShareId: approved.id,
        investorId: approved.investorId,
        tenantId: approved.tenantId ?? "",
        shareAmount: String(approved.shareAmount),
        capitalReturnAmount: String(approved.capitalReturnAmount),
        projectName: approved.projectName,
        periodStart: approved.periodStart.toISOString(),
        periodEnd: approved.periodEnd.toISOString(),
        approvedAt: approvedAt.toISOString(),
      })
      .catch((error: unknown) =>
        logger.warn("[InvestorProfitShareService] Publish profit_share.approved gagal:", error),
      );

    return approved;
  }

  /** Tandai profit share sebagai dibayar: APPROVED → PAID. */
  async markPaid(id: string, paidById: string, payoutId?: string) {
    const record = await this.profitShareRepo.findById(id);
    if (!record) throw new Error("Profit share tidak ditemukan");
    if (record.status !== "APPROVED") {
      throw new Error(
        `Profit share tidak bisa dibayar, status: ${record.status}`,
      );
    }

    return this.profitShareRepo.updateStatus(id, {
      status: "PAID",
      paidAt: new Date(),
      paidById,
      payoutId,
    });
  }

  /** Mengambil daftar profit share berdasarkan investor. */
  async listByInvestor(investorId: string) {
    return this.profitShareRepo.listByInvestor(investorId);
  }

  /** Mengambil semua profit share untuk tenant, opsional filter by status. */
  async listAllByTenant(
    tenantId: string,
    filter?: { status?: InvestorProfitShareStatus },
  ) {
    return this.profitShareRepo.listAll(tenantId, filter);
  }

  /** Mengambil daftar profit share berdasarkan periode. */
  async listByPeriod(tenantId: string, periodStart: Date, periodEnd: Date) {
    return this.profitShareRepo.listByPeriod(tenantId, periodStart, periodEnd);
  }
}
