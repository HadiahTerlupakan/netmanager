import { InvestorDepositService } from "./InvestorDepositService";
import { InvestorBalanceService } from "./InvestorBalanceService";
import { InvestorProfitShareService } from "./InvestorProfitShareService";
import {
  getInvestorPortalDashboardService,
  type InvestorPortalDashboardService,
} from "./InvestorPortalDashboardService";

/** Bagi hasil yang sudah disetujui tetapi belum dibayar ke investor. */
const STATUS_BAGI_HASIL_MENUNGGU_BAYAR = "APPROVED";
/** Bagi hasil batal tidak ditampilkan ke investor. */
const STATUS_BAGI_HASIL_BATAL = "CANCELLED";

/** Setoran modal investor yang boleh dilihat investor sendiri. */
export interface InvestorPortalDeposit {
  id: string;
  amount: number;
  depositType: string;
  date: Date;
  status: string;
  reference: string | null;
  rejectedReason: string | null;
}

/** Bagi hasil per periode yang boleh dilihat investor sendiri. */
export interface InvestorPortalProfitShare {
  id: string;
  /** Proyek RAB sumber; null untuk bagi hasil lama berbasis setoran. */
  projectName: string | null;
  periodStart: Date;
  periodEnd: Date;
  netProfit: number;
  sharePercent: number;
  shareAmount: number;
  /** Pengembalian modal yang dibayar bersama bagi hasil ini. */
  capitalReturnAmount: number;
  status: string;
  paidAt: Date | null;
}

/**
 * Data keuangan milik investor yang sedang login (portal web & mobile):
 * ringkasan Beranda, riwayat setoran modal, dan riwayat bagi hasil. Semua
 * dibatasi `investorId` dari sesi; tidak ada data investor lain yang keluar.
 */
export class InvestorPortalKeuanganService {
  constructor(
    private readonly depositService = new InvestorDepositService(),
    private readonly balanceService = new InvestorBalanceService(),
    private readonly profitShareService = new InvestorProfitShareService(),
    private readonly dashboardService: InvestorPortalDashboardService = getInvestorPortalDashboardService(),
  ) {}

  /**
   * Ringkasan Beranda: dashboard proyek + saldo + uang yang siap dibayar
   * (bagi hasil disetujui beserta pengembalian modalnya).
   */
  async getRingkasan(investorId: string, tenantId: string | null) {
    const [dashboard, balance, profitShares] = await Promise.all([
      this.dashboardService.getDashboard(investorId, tenantId),
      this.balanceService.getBalance(investorId),
      this.profitShareService.listByInvestor(investorId),
    ]);
    const amountAwaitingPayment = profitShares
      .filter((share) => share.status === STATUS_BAGI_HASIL_MENUNGGU_BAYAR)
      .reduce((total, share) => total + share.shareAmount + share.capitalReturnAmount, 0);

    return { ...dashboard, balance, amountAwaitingPayment };
  }

  /** Riwayat setoran modal investor, terbaru dulu. */
  async getDeposits(investorId: string): Promise<InvestorPortalDeposit[]> {
    const deposits = await this.depositService.listByInvestor(investorId);
    return deposits.map((deposit) => ({
      id: deposit.id,
      amount: deposit.amount,
      depositType: deposit.depositType,
      date: deposit.date,
      status: deposit.status,
      reference: deposit.reference,
      rejectedReason: deposit.rejectedReason,
    }));
  }

  /** Riwayat bagi hasil investor (tanpa yang dibatalkan), periode terbaru dulu. */
  async getProfitShares(investorId: string): Promise<InvestorPortalProfitShare[]> {
    const shares = await this.profitShareService.listByInvestor(investorId);
    return shares
      .filter((share) => share.status !== STATUS_BAGI_HASIL_BATAL)
      .map((share) => ({
        id: share.id,
        projectName: share.projectName,
        periodStart: share.periodStart,
        periodEnd: share.periodEnd,
        netProfit: share.netProfit,
        sharePercent: share.sharePercent,
        shareAmount: share.shareAmount,
        capitalReturnAmount: share.capitalReturnAmount,
        status: share.status,
        paidAt: share.paidAt,
      }));
  }
}

let investorPortalKeuanganService: InvestorPortalKeuanganService | null = null;

/** Singleton service keuangan portal investor. */
export function getInvestorPortalKeuanganService() {
  investorPortalKeuanganService ??= new InvestorPortalKeuanganService();
  return investorPortalKeuanganService;
}
