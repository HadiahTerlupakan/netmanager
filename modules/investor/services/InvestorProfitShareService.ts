import { createRouteServiceError } from "@/lib/api/route-service-error";
import { logger } from "@/lib/logger";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-errors";
import { buildRABTrackingDataset } from "@/modules/finance/client";
import type { InvestorProfitShareStatus } from "@prisma/client";

import { bagianInvestor, barisDalamPeriode } from "../domain/bagi-hasil-proyek";
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
const PESAN_TIDAK_DITEMUKAN = "Profit share tidak ditemukan";
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_REQUEST = 400;

/** Galat domain bagi hasil berstatus HTTP (aman ditampilkan ke admin). */
function galatBagiHasil(pesan: string, status = HTTP_BAD_REQUEST) {
  return createRouteServiceError(pesan, status);
}

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
   * investor sesuai porsi modalnya. Bulan proyek yang sudah pernah dibagikan
   * ke investor itu dilewati — aman diulang dan periode boleh tumpang tindih
   * tanpa membayar dua kali.
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
    const barisPeriode = barisDalamPeriode(rows, proyek.startDate, periodStart, periodEnd);
    if (barisPeriode.length === 0) return lewati(ALASAN_TANPA_CAPAIAN);

    const semuaModal = proyek.investors.map((investor) => investor.investmentAmount);
    // Satu query untuk bulan yang sudah dibayar semua investor aktif proyek.
    const bulanDibayarPerInvestor = await this.profitShareRepo.findPaidProjectMonthsByInvestor(
      proyek.id,
      proyek.investors
        .filter((anggota) => anggota.investor.isActive)
        .map((anggota) => anggota.investorId),
    );
    const dibuat = [];
    for (const anggota of proyek.investors) {
      if (!anggota.investor.isActive) continue;
      const sudahDibayar = bulanDibayarPerInvestor.get(anggota.investorId) ?? new Set<number>();
      const barisBaru = barisPeriode.filter((baris) => !sudahDibayar.has(baris.month));
      if (barisBaru.length === 0) continue;

      const bagian = bagianInvestor(
        barisBaru,
        hitungPorsiModal(anggota.investmentAmount, semuaModal),
      );
      const record = await this.simpanBagiHasilSekaliSaja({
        investorId: anggota.investorId,
        rabProjectId: proyek.id,
        projectMonths: bagian.bulan,
        periodStart,
        periodEnd,
        netProfit: bagian.labaBersih,
        sharePercent: bagian.persenDariLaba,
        shareAmount: bagian.bagiHasil,
        capitalReturnAmount: bagian.pengembalianModal,
        tenantId,
      });
      if (record) dibuat.push(record);
    }
    return { dibuat };
  }

  /**
   * Simpan bagi hasil satu investor. Bila kalkulasi lain yang berjalan bersamaan sudah
   * membagikan salah satu bulannya, penjaga unique di DB menolak (P2002) → dilewati.
   */
  private async simpanBagiHasilSekaliSaja(data: Parameters<InvestorProfitShareRepository["create"]>[0]) {
    try {
      return await this.profitShareRepo.create(data);
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) throw error;
      logger.warn("[InvestorProfitShare] Bulan sudah dibagikan oleh kalkulasi lain, dilewati", {
        investorId: data.investorId,
        rabProjectId: data.rabProjectId,
        projectMonths: data.projectMonths,
      });
      return null;
    }
  }

  /** Approve profit share: CALCULATED → APPROVED, publish event untuk notifikasi investor. */
  async approve(id: string, tenantId: string, approvedById: string) {
    const record = await this.profitShareRepo.findById(id, tenantId);
    if (!record) throw galatBagiHasil(PESAN_TIDAK_DITEMUKAN, HTTP_NOT_FOUND);
    if (record.status !== "CALCULATED") {
      throw galatBagiHasil(`Profit share tidak bisa di-approve, status: ${record.status}`);
    }

    const approvedAt = new Date();
    const approved = await this.profitShareRepo.updateStatus(id, tenantId, {
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

  /**
   * Batalkan bagi hasil yang belum dibayar. Yang sudah dibayar tidak bisa
   * dibatalkan karena uangnya sudah dikirim ke investor.
   */
  async cancel(id: string, tenantId: string) {
    const record = await this.profitShareRepo.findById(id, tenantId);
    if (!record) throw galatBagiHasil(PESAN_TIDAK_DITEMUKAN, HTTP_NOT_FOUND);
    if (record.status === "PAID") {
      throw galatBagiHasil("Bagi hasil yang sudah dibayar tidak bisa dibatalkan");
    }
    if (record.status === "CANCELLED") return record;
    return this.profitShareRepo.batalkan(id, tenantId);
  }

  /** Tandai profit share sebagai dibayar: APPROVED → PAID. */
  async markPaid(id: string, tenantId: string, paidById: string, payoutId?: string) {
    const record = await this.profitShareRepo.findById(id, tenantId);
    if (!record) throw galatBagiHasil(PESAN_TIDAK_DITEMUKAN, HTTP_NOT_FOUND);
    if (record.status !== "APPROVED") {
      throw galatBagiHasil(`Profit share tidak bisa dibayar, status: ${record.status}`);
    }

    return this.profitShareRepo.updateStatus(id, tenantId, {
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
