import { PaymentRepository } from "../repositories/PaymentRepository";

/** Bridge service exposing investor-payout repository operations to other modules. */
export class InvestorPaymentBridgeService {
  constructor(private readonly paymentRepository = new PaymentRepository()) {}

  findManyInvestorPayouts(options: {
    investorId: string;
    skip: number;
    take: number;
  }) {
    return this.paymentRepository.findManyInvestorPayouts(options);
  }

  countInvestorPayouts(investorId: string) {
    return this.paymentRepository.countInvestorPayouts(investorId);
  }

  findInvestorById(investorId: string) {
    return this.paymentRepository.findInvestorById(investorId);
  }

  createInvestorPayout(data: {
    investorId: string;
    amount: bigint;
    date: Date;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    reference?: string;
    notes?: string;
    status: string;
  }) {
    return this.paymentRepository.createInvestorPayout(data);
  }

  findInvestorDetail(investorId: string) {
    return this.paymentRepository.findInvestorDetail(investorId);
  }
}

let instance: InvestorPaymentBridgeService | null = null;
export function getInvestorPaymentBridgeService(): InvestorPaymentBridgeService {
  if (!instance) instance = new InvestorPaymentBridgeService();
  return instance;
}
