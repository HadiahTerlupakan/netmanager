import { logActivitySafe } from "@/lib/logger";
import { FinancialAccountRepository } from "../repositories";

type AccountType = "BANK" | "CASH" | "EWALLET" | "OTHER";

type FinancialAccountRepo = Pick<
  FinancialAccountRepository,
  "findActive" | "create" | "transferBetweenAccounts"
>;

export class FinanceAccountFacadeService {
  constructor(
    private readonly financialAccountRepo: FinancialAccountRepo = new FinancialAccountRepository(),
  ) {}

  /** Get all active financial accounts. */
  async getAccounts() {
    return this.financialAccountRepo.findActive();
  }

  /** Create a new financial account. */
  async createAccount(data: {
    name: string;
    type: AccountType;
    accountNumber?: string;
    description?: string;
    initialBalance?: number;
  }) {
    return this.financialAccountRepo.create({
      name: data.name,
      type: data.type,
      accountNumber: data.accountNumber ?? null,
      description: data.description ?? null,
      balance: data.initialBalance || 0,
      isActive: true,
    });
  }

  /** Transfer funds between accounts. */
  async transferFunds(data: {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    createdById: string;
  }) {
    const result = await this.financialAccountRepo.transferBetweenAccounts({
      sourceAccountId: data.sourceAccountId,
      destinationAccountId: data.destinationAccountId,
      amount: data.amount,
    });

    logActivitySafe({
      action: "TRANSFER",
      subject: "Finance Funds",
      userId: data.createdById,
      details: {
        from: data.sourceAccountId,
        to: data.destinationAccountId,
        amount: data.amount,
      },
    });

    return result;
  }
}
