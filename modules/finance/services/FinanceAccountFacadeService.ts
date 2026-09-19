import { logActivitySafe } from "@/lib/logger";
import { FinancialAccountRepository } from "../repositories";

type AccountType = "BANK" | "CASH" | "EWALLET" | "OTHER";

type FinancialAccountRepo = Pick<
  FinancialAccountRepository,
  "findActive" | "create" | "transferBetweenAccounts" | "findRecentMutations"
>;

/** Banyaknya riwayat mutasi yang ditampilkan di halaman Kas & Bank. */
const RECENT_MUTATION_LIMIT = 20;

export class FinanceAccountFacadeService {
  constructor(
    private readonly financialAccountRepo: FinancialAccountRepo = new FinancialAccountRepository(),
  ) {}

  /** Get all active financial accounts. */
  async getAccounts() {
    return this.financialAccountRepo.findActive();
  }

  /** Riwayat mutasi saldo terbaru untuk ditampilkan di halaman Kas & Bank. */
  async getRecentMutations(limit: number = RECENT_MUTATION_LIMIT) {
    return this.financialAccountRepo.findRecentMutations(limit);
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

  /**
   * Transfer funds between accounts.
   *
   * Tanggal dan keterangan yang diisi operator tersimpan sebagai baris
   * `TreasuryMutation` di transaksi yang sama dengan perubahan saldo —
   * sebelumnya kedua nilai itu diminta di form lalu dibuang, dan transfer sama
   * sekali tidak meninggalkan jejak yang bisa direkonsiliasi. Log aktivitas
   * tetap ditulis sebagai jejak audit lintas modul.
   */
  async transferFunds(data: {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    date: Date | string;
    description?: string;
    createdById: string;
  }) {
    const result = await this.financialAccountRepo.transferBetweenAccounts({
      sourceAccountId: data.sourceAccountId,
      destinationAccountId: data.destinationAccountId,
      amount: data.amount,
      date: data.date,
      ...(data.description ? { description: data.description } : {}),
      createdById: data.createdById,
    });

    logActivitySafe({
      action: "TRANSFER",
      subject: "Finance Funds",
      userId: data.createdById,
      details: {
        from: data.sourceAccountId,
        to: data.destinationAccountId,
        amount: data.amount,
        date: new Date(data.date).toISOString(),
        ...(data.description ? { description: data.description } : {}),
      },
    });

    return result;
  }
}
