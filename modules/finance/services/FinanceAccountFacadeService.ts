import { logActivitySafe } from "@/lib/logger";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import {
  getChartOfAccountService,
  postAccountOpeningJournal,
  postTreasuryTransferJournal,
} from "@/modules/accounting";

import {
  InsufficientBalanceError,
  InvalidChartOfAccountError,
} from "../domain/errors";
import { FinancialAccountRepository } from "../repositories";
import type { AccountUpdateInput } from "../repositories/FinancialAccountRepository";

type AccountType = "BANK" | "CASH" | "EWALLET" | "OTHER";

type FinancialAccountRepo = Pick<
  FinancialAccountRepository,
  | "findActive"
  | "findById"
  | "create"
  | "update"
  | "transferBetweenAccounts"
  | "recordTransferMutation"
  | "findRecentMutations"
>;

/** Buku besar yang menjadi sumber saldo rekening bertaut COA. */
export type AccountLedger = {
  getBalances: (
    tenantId: string,
    coaIds: string[],
  ) => Promise<Map<string, number>>;
  postTransfer: typeof postTreasuryTransferJournal;
  postOpening: typeof postAccountOpeningJournal;
};

const DEFAULT_LEDGER: AccountLedger = {
  getBalances: (tenantId, coaIds) =>
    getChartOfAccountService().getBalances(tenantId, coaIds),
  postTransfer: postTreasuryTransferJournal,
  postOpening: postAccountOpeningJournal,
};

async function contextTenantId() {
  return (await getTenantIdFromContext()).tenantId ?? null;
}

/** Banyaknya riwayat mutasi yang ditampilkan di halaman Kas & Bank. */
const RECENT_MUTATION_LIMIT = 20;

export class FinanceAccountFacadeService {
  constructor(
    private readonly financialAccountRepo: FinancialAccountRepo = new FinancialAccountRepository(),
    private readonly ledger: AccountLedger = DEFAULT_LEDGER,
    private readonly resolveTenantId: () => Promise<
      string | null
    > = contextTenantId,
  ) {}

  /**
   * Rekening aktif beserta saldonya. Rekening yang ditautkan ke COA bersaldo
   * jurnal, sehingga Kas & Bank, buku besar, dan arus kas selalu sama;
   * angka tersimpannya dulu tidak bergerak saat pelanggan membayar, gaji
   * dibayar, atau pengeluaran dicatat. Rekening tanpa COA tetap memakai
   * angka tersimpan.
   */
  async getAccounts() {
    const accounts = await this.financialAccountRepo.findActive();
    const tenantId = await this.resolveTenantId();
    const coaIds = accounts.flatMap((a) => (a.coaId ? [a.coaId] : []));
    const balances =
      tenantId && coaIds.length > 0
        ? await this.ledger.getBalances(tenantId, coaIds)
        : new Map<string, number>();
    return accounts.map((account) =>
      account.coaId && tenantId
        ? {
            ...account,
            balance: balances.get(account.coaId) ?? 0,
            balanceSource: "JOURNAL" as const,
          }
        : { ...account, balanceSource: "STORED" as const },
    );
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

    const account = await this.financialAccountRepo.create({
      name: data.name,
      type: data.type,
      accountNumber: data.accountNumber ?? null,
      description: data.description ?? null,
      balance: data.initialBalance || 0,
      isActive: true,
      ...(data.coaId ? { coaId: data.coaId } : {}),
    });

    // Saldo rekening bertaut COA berasal dari jurnal; tanpa jurnal saldo awal,
    // saldo yang diisi di form tidak pernah terlihat.
    const tenantId = data.tenantId ?? (await this.resolveTenantId());
    if (data.coaId && tenantId && (data.initialBalance ?? 0) > 0) {
      await this.ledger.postOpening({
        tenantId,
        accountId: account.id,
        accountName: data.name,
        coaId: data.coaId,
        amount: data.initialBalance as number,
        date: new Date(),
      });
    }
    return account;
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
    const result = await this.moveFunds(data);

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

  /**
   * Rekening yang keduanya bertaut COA dipindah lewat jurnal (saldonya dari
   * jurnal); selebihnya lewat angka tersimpan seperti sebelumnya.
   */
  private async moveFunds(data: {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    date: Date | string;
    description?: string;
    createdById: string;
  }) {
    const transfer = {
      sourceAccountId: data.sourceAccountId,
      destinationAccountId: data.destinationAccountId,
      amount: data.amount,
      date: data.date,
      ...(data.description ? { description: data.description } : {}),
      createdById: data.createdById,
    };
    const [source, destination, tenantId] = await Promise.all([
      this.financialAccountRepo.findById(data.sourceAccountId),
      this.financialAccountRepo.findById(data.destinationAccountId),
      this.resolveTenantId(),
    ]);
    if (!source?.coaId || !destination?.coaId || !tenantId) {
      return this.financialAccountRepo.transferBetweenAccounts(transfer);
    }

    const balances = await this.ledger.getBalances(tenantId, [source.coaId]);
    const available = balances.get(source.coaId) ?? 0;
    if (available < data.amount) {
      throw new InsufficientBalanceError(
        data.sourceAccountId,
        data.amount,
        available,
      );
    }

    const mutation =
      await this.financialAccountRepo.recordTransferMutation(transfer);
    await this.ledger.postTransfer({
      tenantId,
      mutationId: mutation.id,
      date: new Date(data.date),
      amount: data.amount,
      sourceCoaId: source.coaId,
      destinationCoaId: destination.coaId,
      ...(data.description ? { description: data.description } : {}),
      postedBy: data.createdById,
    });
    return { success: true as const };
  }
}
