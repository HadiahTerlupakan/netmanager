import { InvestorPaymentBridgeService } from "@/modules/finance";

export interface InvestorPayoutListInput {
  investorId: string;
  page: number;
  limit: number;
}

export interface InvestorPayoutCreateInput {
  investorId: string;
  amount: number;
  date?: Date;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  reference?: string;
  notes?: string;
  status?: string;
}

const DEFAULT_STATUS = "COMPLETED";

export class InvestorPayoutAdminService {
  constructor(
    private readonly paymentBridge = new InvestorPaymentBridgeService(),
  ) {}

  /** Mengambil daftar payout investor dengan pagination. */
  async getInvestorPayouts(input: InvestorPayoutListInput) {
    const skip = (input.page - 1) * input.limit;
    const [payouts, total] = await Promise.all([
      this.paymentBridge.findManyInvestorPayouts({
        investorId: input.investorId,
        skip,
        take: input.limit,
      }),
      this.paymentBridge.countInvestorPayouts(input.investorId),
    ]);

    return { payouts, total };
  }

  /** Membuat payout investor baru. */
  async createInvestorPayout(input: InvestorPayoutCreateInput) {
    const investor = await this.paymentBridge.findInvestorById(
      input.investorId,
    );

    if (!investor) {
      return null;
    }

    return this.paymentBridge.createInvestorPayout({
      investorId: input.investorId,
      amount: BigInt(input.amount),
      date: input.date || new Date(),
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      accountName: input.accountName,
      reference: input.reference,
      notes: input.notes,
      status: input.status || DEFAULT_STATUS,
    });
  }

  /** Mengambil detail investor beserta histori payout dan proyek. */
  async getInvestorDetail(investorId: string) {
    const investor = await this.paymentBridge.findInvestorDetail(investorId);

    if (!investor) {
      return null;
    }

    const { passwordHash: _passwordHash, ...safeInvestor } = investor;
    return safeInvestor;
  }
}

let instance: InvestorPayoutAdminService | null = null;
export function getInvestorPayoutAdminService(): InvestorPayoutAdminService {
  if (!instance) instance = new InvestorPayoutAdminService();
  return instance;
}
