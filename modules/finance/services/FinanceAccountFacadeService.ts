import { logActivitySafe } from "@/lib/logger";
import { getChartOfAccountService } from "@/modules/accounting";

import { InvalidChartOfAccountError } from "../domain/errors";
import { FinancialAccountRepository } from "../repositories";
import type { AccountUpdateInput } from "../repositories/FinancialAccountRepository";

type AccountType = "BANK" | "CASH" | "EWALLET" | "OTHER";

type FinancialAccountRepo = Pick<
  FinancialAccountRepository,
  | "findActive"
  | "create"
  | "update"
  | "transferBetweenAccounts"
  | "findRecentMutations"
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

  /**
   * Ubah atribut akun, termasuk tautan COA-nya.
   *
   * Tautan COA bukan sekadar label: handler jurnal menurunkan sisi kredit dari
   * `financial_accounts.coaId`, jadi selama kosong tidak ada satu pun jurnal
   * pengeluaran/pembayaran yang bisa terbentuk — dan laporan arus kas ikut
   * kosong. Karena kolomnya tidak punya foreign key, kelayakan akun COA
   * diperiksa di sini.
   */
  async updateAccount(
    id: string,
    tenantId: string | null,
    data: AccountUpdateInput,
  ) {
    if (data.coaId) {
      await this.assertPostableCoa(tenantId, data.coaId);
    }
    return this.financialAccountRepo.update(id, data);
  }

  private async assertPostableCoa(tenantId: string | null, coaId: string) {
    const coa = await getChartOfAccountService().findById(coaId);
    if (!coa || (tenantId && coa.tenantId !== tenantId)) {
      throw new InvalidChartOfAccountError("Akun COA tidak ditemukan");
    }
    if (!coa.isPostable) {
      throw new InvalidChartOfAccountError(
        `Akun COA ${coa.code} adalah akun header dan tidak bisa menerima jurnal; pilih akun yang bisa diposting`,
      );
    }
    if (!coa.isActive) {
      throw new InvalidChartOfAccountError(
        `Akun COA ${coa.code} tidak aktif; pilih akun yang aktif`,
      );
    }
  }

  /** Create a new financial account. */
  async createAccount(data: {
    name: string;
    type: AccountType;
    accountNumber?: string;
    description?: string;
    initialBalance?: number;
    coaId?: string;
    tenantId?: string | null;
  }) {
    if (data.coaId) {
      await this.assertPostableCoa(data.tenantId ?? null, data.coaId);
    }

    return this.financialAccountRepo.create({
      name: data.name,
      type: data.type,
      accountNumber: data.accountNumber ?? null,
      description: data.description ?? null,
      balance: data.initialBalance || 0,
      isActive: true,
      ...(data.coaId ? { coaId: data.coaId } : {}),
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
