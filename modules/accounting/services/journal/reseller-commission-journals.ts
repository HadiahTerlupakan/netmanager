import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { resellerCommissionAccrualRef } from "@/lib/event-bus/types";
import type { IChartOfAccountRepository } from "../../domain/ports/IChartOfAccountRepository";
import type { IJournalRepository } from "../../domain/ports/IJournalRepository";
import type { ChartOfAccount } from "../../domain/entities/ChartOfAccount";
import type { JournalLineDraft } from "../../domain/entities/JournalLine";
import {
  AccountingError,
  CoaNotFoundError,
  JournalAlreadyReversedError,
  PeriodClosedError,
} from "../../errors";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-errors";
import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { JournalRepository } from "../../repositories/JournalRepository";
import { ensureDefaultAccounts } from "../coa/ensure-default-accounts";
import {
  getCoaCode,
  getDefaultCoaCode,
  type CoaPurpose,
} from "../event-handlers/coa-mapping-config";
import type { JournalPostingService } from "./JournalPostingService";
import type { JournalReverseService } from "./JournalReverseService";
import {
  autoPostingService,
  ensurePeriod,
  journalReverseService,
} from "./auto-posting";

/**
 * Jurnal komisi reseller (model agen, PM 5/2021 Ps 223(2)b.3).
 *
 * Seluruh tagihan pelanggan reseller adalah pendapatan ISP dan dibukukan bruto
 * oleh jurnal tagihan; komisi reseller adalah BEBAN, bukan pengurang
 * pendapatan. Karena itu tidak ada satu pun jurnal di sini yang menyentuh akun
 * REVENUE, dan basis BHP/USO (jumlah kredit akun REVENUE, lihat
 * `modules/tax/services/BhpUsoService.ts`) tetap tagihan bruto:
 *   akru   : Dr Beban Komisi Reseller  / Cr Utang Komisi Reseller
 *   bayar  : Dr Utang Komisi Reseller  / Cr Kas/Bank rekening terpilih
 *   batal  : jurnal akru dibalik (JournalReverseService)
 *
 * Utang komisi tidak boleh bersaldo debit: setiap komisi yang dibayar harus
 * punya jurnal akru. Akru yang hilang (event gagal, COA belum di-seed saat
 * itu, periode tertutup) disusulkan saat settlement dibayar, dengan ref yang
 * sama sehingga job akru yang datang belakangan tetap idempoten.
 */

export const RESELLER_COMMISSION_REF_TYPE = "ResellerCommission";
export const RESELLER_SETTLEMENT_REF_TYPE = "ResellerSettlement";
const SYSTEM_ACTOR = "system";
const EXPENSE_PURPOSE: CoaPurpose = "BEBAN_KOMISI_RESELLER";
const PAYABLE_PURPOSE: CoaPurpose = "UTANG_KOMISI_RESELLER";
const CASH_ACCOUNT_TYPE = "CASH";
const SOURCE = "[ResellerCommissionJournals]";

interface PaymentAccount {
  readonly coaId: string | null;
  readonly type: string;
}

/** Keadaan komisi saat ini, dibaca dari tabel komisi reseller. */
export interface CommissionAccrualState {
  readonly id: string;
  readonly invoiceId: string;
  readonly commissionAmount: number;
  readonly accruedAt: Date;
  readonly deletedAt: Date | null;
}

/** Dependensi jurnal komisi; diganti di tes. */
export interface ResellerCommissionJournalDeps {
  readonly coaRepo: IChartOfAccountRepository;
  readonly journalRepo: Pick<IJournalRepository, "findBySource">;
  readonly posting: Pick<JournalPostingService, "postAuto">;
  readonly reverser: Pick<JournalReverseService, "reverse">;
  readonly ensurePeriod: (tenantId: string, date: Date) => Promise<void>;
  /** Rekening Kas & Bank milik tenant; null bila tidak ada di tenant itu. */
  readonly findPaymentAccount: (
    tenantId: string,
    accountId: string,
  ) => Promise<PaymentAccount | null>;
  /** Komisi milik tenant (termasuk yang dibatalkan); null bila tidak ada. */
  readonly findCommission: (
    tenantId: string,
    commissionId: string,
  ) => Promise<CommissionAccrualState | null>;
  /** Komisi aktif (belum dibatalkan) di dalam settlement. */
  readonly listSettlementCommissions: (
    tenantId: string,
    settlementId: string,
  ) => Promise<readonly CommissionAccrualState[]>;
  readonly now: () => Date;
}

const COMMISSION_STATE_SELECT = {
  id: true,
  invoiceId: true,
  commissionAmount: true,
  accruedAt: true,
  deletedAt: true,
} as const;

function defaultDeps(): ResellerCommissionJournalDeps {
  return {
    coaRepo: new ChartOfAccountRepository(),
    journalRepo: new JournalRepository(),
    posting: autoPostingService(),
    reverser: journalReverseService(),
    ensurePeriod,
    findPaymentAccount: (tenantId, accountId) =>
      prisma.financialAccount.findFirst({
        where: { id: accountId, tenantId },
        select: { coaId: true, type: true },
      }),
    findCommission: (tenantId, commissionId) =>
      prisma.resellerCommission.findFirst({
        where: { id: commissionId, tenantId },
        select: COMMISSION_STATE_SELECT,
      }),
    listSettlementCommissions: (tenantId, settlementId) =>
      prisma.resellerCommission.findMany({
        where: { settlementId, tenantId, deletedAt: null },
        select: COMMISSION_STATE_SELECT,
        orderBy: { accruedAt: "asc" },
      }),
    now: () => new Date(),
  };
}

export interface CommissionAccrualJournalInput {
  readonly tenantId: string;
  readonly commissionId: string;
  readonly accrualRef: string;
  readonly invoiceId: string;
  readonly amount: number;
  readonly accruedAt: Date;
}

export interface CommissionCancellationJournalInput {
  readonly tenantId: string;
  readonly accrualRef: string;
  readonly invoiceId: string;
}

export interface SettlementPaymentJournalInput {
  readonly tenantId: string;
  readonly settlementId: string;
  readonly amount: number;
  readonly paidAt: Date;
  readonly accountId: string;
}

/**
 * Akru komisi: Dr Beban Komisi Reseller / Cr Utang Komisi Reseller (idempoten
 * per ref).
 *
 * Event bisa tiba setelah komisinya dibatalkan (job akru tertunda lebih lama
 * dari job pembatalan). Karena itu keadaan komisi dibaca sebelum dan sesudah
 * posting: akrual yang sudah tidak berlaku dilewati, dan yang batal tepat saat
 * posting langsung dibalik. Dengan begitu pembatalan yang belum menemukan
 * jurnal akru cukup tidak melakukan apa-apa.
 */
export async function postResellerCommissionAccrual(
  input: CommissionAccrualJournalInput,
  deps: ResellerCommissionJournalDeps = defaultDeps(),
): Promise<boolean> {
  if (input.amount <= 0) return false;
  if (!(await isCurrentAccrual(deps, input))) {
    logger.info(
      `${SOURCE} Akrual ${input.accrualRef} tidak berlaku lagi; jurnal akru dilewati`,
    );
    return false;
  }
  await postAccrualJournal(deps, input, deps.now());
  if (!(await isCurrentAccrual(deps, input))) {
    await reverseAccrualJournal(deps, input);
  }
  return true;
}

/** Komisi masih aktif dan `accruedAt`-nya sama dengan akrual yang dijurnal. */
async function isCurrentAccrual(
  deps: ResellerCommissionJournalDeps,
  input: CommissionAccrualJournalInput,
): Promise<boolean> {
  const commission = await deps.findCommission(
    input.tenantId,
    input.commissionId,
  );
  return (
    commission !== null &&
    commission.deletedAt === null &&
    commission.accruedAt.getTime() === input.accruedAt.getTime()
  );
}

/**
 * Posting jurnal akru bertanggal `accruedAt`. Bila periode itu sudah ditutup,
 * jurnalnya disusulkan pada `fallbackDate` (periode berjalan), seperti koreksi
 * yang ditemukan setelah tutup buku; tanpa itu job gagal permanen dan utang
 * komisi tidak pernah diakui.
 */
async function postAccrualJournal(
  deps: ResellerCommissionJournalDeps,
  input: CommissionAccrualJournalInput,
  fallbackDate: Date,
): Promise<void> {
  const { expense, payable } = await resolveCommissionAccounts(
    deps,
    input.tenantId,
  );
  const amount = String(input.amount);
  const post = async (entryDate: Date, note: string) => {
    await deps.ensurePeriod(input.tenantId, entryDate);
    await deps.posting.postAuto(input.tenantId, {
      source: "AUTO_RESELLER_COMMISSION",
      sourceRefType: RESELLER_COMMISSION_REF_TYPE,
      sourceRefId: input.accrualRef,
      entryDate,
      description: `Akru komisi reseller atas invoice ${input.invoiceId}${note}`,
      lines: [
        { coaId: expense.id, side: "DEBIT", amount },
        { coaId: payable.id, side: "CREDIT", amount },
      ],
    });
  };
  try {
    await post(input.accruedAt, "");
  } catch (error) {
    if (!(error instanceof PeriodClosedError)) throw error;
    await post(fallbackDate, " (susulan: periode akru sudah ditutup)");
  }
}

/**
 * Balik jurnal akru komisi yang dibatalkan. Idempoten: jurnal yang sudah
 * REVERSED dilewati. Bila jurnal akrunya belum ada, tidak ada yang dibalik:
 * job akru yang datang belakangan memeriksa ulang keadaan komisi dan tidak
 * memposting (atau langsung membalik) akrual yang sudah batal.
 */
export async function reverseResellerCommissionAccrual(
  input: CommissionCancellationJournalInput,
  deps: ResellerCommissionJournalDeps = defaultDeps(),
): Promise<boolean> {
  return reverseAccrualJournal(deps, input);
}

async function reverseAccrualJournal(
  deps: ResellerCommissionJournalDeps,
  input: CommissionCancellationJournalInput,
): Promise<boolean> {
  const accrual = await deps.journalRepo.findBySource(
    input.tenantId,
    "AUTO_RESELLER_COMMISSION",
    input.accrualRef,
  );
  if (!accrual || accrual.status === "REVERSED") return false;

  // Jurnal pembalik bertanggal hari ini; periodenya dibuat dulu.
  await deps.ensurePeriod(input.tenantId, deps.now());
  try {
    await deps.reverser.reverse(
      accrual.id,
      `Komisi reseller dibatalkan: invoice ${input.invoiceId} tidak lagi lunas`,
      SYSTEM_ACTOR,
    );
  } catch (error) {
    // Pembatalan dan pemeriksaan ulang job akru bisa membalik bersamaan;
    // unique (tenantId, REVERSAL, id jurnal) membuat yang kalah gagal di sini.
    if (isAlreadyReversed(error)) return false;
    throw error;
  }
  return true;
}

function isAlreadyReversed(error: unknown): boolean {
  return (
    error instanceof JournalAlreadyReversedError ||
    isPrismaUniqueConstraintError(error)
  );
}

/**
 * Bayar settlement: Dr Utang Komisi Reseller / Cr Kas/Bank rekening terpilih.
 *
 * Sebelum utang didebit, jurnal akru setiap komisi di settlement disusulkan
 * bila belum ada (idempoten per ref). Tanpa itu komisi yang akrunya tidak
 * pernah terjurnal membuat Utang Komisi bersaldo debit dan bebannya tidak
 * pernah diakui.
 */
export async function postResellerSettlementPayment(
  input: SettlementPaymentJournalInput,
  deps: ResellerCommissionJournalDeps = defaultDeps(),
): Promise<boolean> {
  if (input.amount <= 0) return false;
  const { payable } = await resolveCommissionAccounts(deps, input.tenantId);
  const cashCoaId = await resolvePaymentCoaId(
    deps,
    input.tenantId,
    input.accountId,
  );
  await ensureSettlementAccruals(deps, input);
  const amount = String(input.amount);
  await deps.ensurePeriod(input.tenantId, input.paidAt);
  await deps.posting.postAuto(input.tenantId, {
    source: "AUTO_RESELLER_SETTLEMENT_PAID",
    sourceRefType: RESELLER_SETTLEMENT_REF_TYPE,
    sourceRefId: input.settlementId,
    entryDate: input.paidAt,
    description: `Pembayaran settlement komisi reseller ${input.settlementId}`,
    lines: buildSettlementLines(payable.id, cashCoaId, amount),
  });
  return true;
}

/** Susulkan jurnal akru komisi settlement yang belum punya (postAuto idempoten). */
async function ensureSettlementAccruals(
  deps: ResellerCommissionJournalDeps,
  input: SettlementPaymentJournalInput,
): Promise<void> {
  const commissions = await deps.listSettlementCommissions(
    input.tenantId,
    input.settlementId,
  );
  for (const commission of commissions) {
    if (commission.commissionAmount <= 0) continue;
    await postAccrualJournal(
      deps,
      {
        tenantId: input.tenantId,
        commissionId: commission.id,
        accrualRef: resellerCommissionAccrualRef(
          commission.id,
          commission.accruedAt,
        ),
        invoiceId: commission.invoiceId,
        amount: commission.commissionAmount,
        accruedAt: commission.accruedAt,
      },
      input.paidAt,
    );
  }
}

function buildSettlementLines(
  payableCoaId: string,
  cashCoaId: string,
  amount: string,
): JournalLineDraft[] {
  return [
    { coaId: payableCoaId, side: "DEBIT", amount },
    { coaId: cashCoaId, side: "CREDIT", amount },
  ];
}

/**
 * Akun beban dan utang komisi; dibuat di COA tenant bila belum ada. Jenisnya
 * diperiksa supaya pemetaan yang salah tidak pernah mendebit akun REVENUE
 * (yang akan mengecilkan basis BHP/USO).
 */
async function resolveCommissionAccounts(
  deps: ResellerCommissionJournalDeps,
  tenantId: string,
): Promise<{ expense: ChartOfAccount; payable: ChartOfAccount }> {
  await ensureDefaultAccounts(deps.coaRepo, tenantId, [
    getDefaultCoaCode(EXPENSE_PURPOSE),
    getDefaultCoaCode(PAYABLE_PURPOSE),
  ]);
  const [expense, payable] = await Promise.all([
    findAccount(deps, tenantId, EXPENSE_PURPOSE),
    findAccount(deps, tenantId, PAYABLE_PURPOSE),
  ]);
  assertAccountType(expense, "EXPENSE");
  assertAccountType(payable, "LIABILITY");
  return { expense, payable };
}

async function findAccount(
  deps: ResellerCommissionJournalDeps,
  tenantId: string,
  purpose: CoaPurpose,
): Promise<ChartOfAccount> {
  const code = await getCoaCode(tenantId, purpose);
  const account = await deps.coaRepo.findByCode(tenantId, code);
  if (!account) throw new CoaNotFoundError(code);
  return account;
}

function assertAccountType(
  account: ChartOfAccount,
  expected: ChartOfAccount["type"],
): void {
  if (account.type === expected) return;
  throw new AccountingError(
    `Akun ${account.code} bertipe ${account.type}, komisi reseller butuh ${expected}`,
    "RESELLER_COMMISSION_COA_INVALID",
  );
}

/**
 * COA rekening pembayar. Rekening tanpa tautan COA memakai Kas Utama untuk
 * rekening tunai dan Bank Utama untuk lainnya.
 */
async function resolvePaymentCoaId(
  deps: ResellerCommissionJournalDeps,
  tenantId: string,
  accountId: string,
): Promise<string> {
  const account = await deps.findPaymentAccount(tenantId, accountId);
  if (!account) {
    throw new AccountingError(
      `Rekening ${accountId} tidak ada di tenant ${tenantId}`,
      "PAYMENT_ACCOUNT_NOT_FOUND",
    );
  }
  if (account.coaId) {
    const linked = await deps.coaRepo.findById(account.coaId);
    if (!linked || linked.tenantId !== tenantId) {
      throw new AccountingError(
        `COA rekening ${accountId} tidak ada di tenant ${tenantId}`,
        "PAYMENT_ACCOUNT_COA_INVALID",
      );
    }
    assertAccountType(linked, "ASSET");
    return linked.id;
  }
  const fallback: CoaPurpose =
    account.type === CASH_ACCOUNT_TYPE ? "KAS_UTAMA" : "BANK_UTAMA";
  return (await findAccount(deps, tenantId, fallback)).id;
}
