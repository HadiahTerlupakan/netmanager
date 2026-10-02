import { InvestorPayoutRepository } from "../repositories/InvestorPayoutRepository";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
/** Batas atas per halaman agar klien tidak bisa meminta seluruh riwayat sekaligus. */
const MAX_LIMIT = 50;

function normalizePositiveNumber(value: string | null, fallback: number) {
  const parsedValue = Number.parseInt(value || "", 10);
  if (Number.isNaN(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
}

export class InvestorPortalPayoutService {
  constructor(
    private readonly payoutRepository = new InvestorPayoutRepository(),
  ) {}

  /** Mengambil daftar payout investor dengan pagination ter-normalisasi. */
  async getPayouts(investorId: string, query: URLSearchParams) {
    const page = normalizePositiveNumber(query.get("page"), DEFAULT_PAGE);
    const limit = Math.min(
      normalizePositiveNumber(query.get("limit"), DEFAULT_LIMIT),
      MAX_LIMIT,
    );
    const skip = (page - 1) * limit;
    const [payouts, total] = await Promise.all([
      this.payoutRepository.findManyByInvestor({
        investorId,
        skip,
        take: limit,
      }),
      this.payoutRepository.countByInvestor(investorId),
    ]);

    return {
      data: payouts.map((payout) => ({
        ...payout,
        amount: payout.amount.toString(),
      })),
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }
}

let investorPortalPayoutService: InvestorPortalPayoutService | null = null;

export function getInvestorPortalPayoutService() {
  if (!investorPortalPayoutService) {
    investorPortalPayoutService = new InvestorPortalPayoutService();
  }

  return investorPortalPayoutService;
}
