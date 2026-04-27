import { PaymentRepository } from "../repositories/PaymentRepository";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

function normalizePositiveNumber(value: string | null, fallback: number) {
  const parsedValue = Number.parseInt(value || "", 10);
  if (Number.isNaN(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
}

export class InvestorPortalPayoutService {
  constructor(private readonly paymentRepository = new PaymentRepository()) {}

  /** Mengambil daftar payout investor dengan pagination ter-normalisasi. */
  async getPayouts(investorId: string, query: URLSearchParams) {
    const page = normalizePositiveNumber(query.get("page"), DEFAULT_PAGE);
    const limit = normalizePositiveNumber(query.get("limit"), DEFAULT_LIMIT);
    const skip = (page - 1) * limit;
    const [payouts, total] = await Promise.all([
      this.paymentRepository.findManyInvestorPayouts({
        investorId,
        skip,
        take: limit,
      }),
      this.paymentRepository.countInvestorPayouts(investorId),
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
