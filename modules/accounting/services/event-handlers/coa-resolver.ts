import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { CoaNotFoundError } from "../../errors";
import { getCoaCode } from "./coa-mapping-config";

interface ResolvedCoa {
  debitCoaId: string;
  creditCoaId: string;
}

async function findCoaByCode(tenantId: string, code: string): Promise<string> {
  const coa = await prisma.chartOfAccount.findUnique({
    where: { tenantId_code: { tenantId, code } },
    select: { id: true },
  });
  if (!coa) {
    throw new CoaNotFoundError(code);
  }
  return coa.id;
}

async function resolveCoaId(
  tenantId: string,
  ...purposes: Parameters<typeof getCoaCode>[1][]
): Promise<string[]> {
  const codes = await Promise.all(purposes.map((p) => getCoaCode(tenantId, p)));
  return Promise.all(codes.map((code) => findCoaByCode(tenantId, code)));
}

async function findBankCoaByAccountId(
  tenantId: string,
  accountId: string,
): Promise<string> {
  const account = await prisma.financialAccount.findUnique({
    where: { id: accountId },
    select: { coaId: true },
  });
  if (account?.coaId) {
    return account.coaId;
  }
  logger.warn(
    `[coa-resolver] FinancialAccount ${accountId} has no linked COA, falling back to default bank`,
  );
  const bankCode = await getCoaCode(tenantId, "BANK_UTAMA");
  return findCoaByCode(tenantId, bankCode);
}

export async function resolveInvoiceCreatedCoa(
  tenantId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await resolveCoaId(
    tenantId,
    "PIUTANG_USAHA",
    "PENDAPATAN_JASA",
  );
  return { debitCoaId, creditCoaId };
}

export async function resolveInvoicePaidCoa(
  tenantId: string,
  accountId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await Promise.all([
    findBankCoaByAccountId(tenantId, accountId),
    resolveCoaId(tenantId, "PIUTANG_USAHA").then((ids) => ids[0]),
  ]);
  return { debitCoaId, creditCoaId };
}

export async function resolveExpenseApprovedCoa(
  tenantId: string,
  expenseCategoryId: string,
  accountId: string,
): Promise<ResolvedCoa> {
  const category = await prisma.expenseCategory.findUnique({
    where: { id: expenseCategoryId },
    select: { coaId: true },
  });

  const debitCoaId =
    category?.coaId ??
    (await resolveCoaId(tenantId, "BEBAN_LAINNYA").then((ids) => ids[0]));
  const creditCoaId = await findBankCoaByAccountId(tenantId, accountId);

  return { debitCoaId, creditCoaId };
}

export async function resolvePurchaseOrderPaidCoa(
  tenantId: string,
  accountId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await Promise.all([
    resolveCoaId(tenantId, "PERSEDIAAN").then((ids) => ids[0]),
    findBankCoaByAccountId(tenantId, accountId),
  ]);
  return { debitCoaId, creditCoaId };
}

export async function resolveCouponUsedCoa(
  tenantId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await resolveCoaId(
    tenantId,
    "POTONGAN_KUPON",
    "PIUTANG_USAHA",
  );
  return { debitCoaId, creditCoaId };
}

export async function resolveMitraWithdrawalCoa(
  tenantId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await resolveCoaId(
    tenantId,
    "BEBAN_MITRA",
    "KAS_KECIL",
  );
  return { debitCoaId, creditCoaId };
}

export async function resolveInvestorPayoutCoa(
  tenantId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await resolveCoaId(
    tenantId,
    "BEBAN_INVESTOR",
    "KAS_KECIL",
  );
  return { debitCoaId, creditCoaId };
}

export interface SalaryResolvedCoa {
  bebanGajiCoaId: string;
  bebanBpjsCoaId: string;
  utangGajiCoaId: string;
  utangPph21CoaId: string;
  utangBpjsCoaId: string;
  piutangKaryawanCoaId: string;
}

export async function resolveSalaryProcessedCoa(
  tenantId: string,
): Promise<SalaryResolvedCoa> {
  const [
    bebanGajiCoaId,
    bebanBpjsCoaId,
    utangGajiCoaId,
    utangPph21CoaId,
    utangBpjsCoaId,
    piutangKaryawanCoaId,
  ] = await resolveCoaId(
    tenantId,
    "BEBAN_GAJI",
    "BEBAN_BPJS",
    "UTANG_GAJI",
    "UTANG_PPH_21",
    "UTANG_BPJS",
    "PIUTANG_KARYAWAN",
  );
  return {
    bebanGajiCoaId,
    bebanBpjsCoaId,
    utangGajiCoaId,
    utangPph21CoaId,
    utangBpjsCoaId,
    piutangKaryawanCoaId,
  };
}

export interface SalaryAdvanceResolvedCoa {
  piutangKaryawanCoaId: string;
  kasCoaId: string;
}

export async function resolveAdvanceDisbursedCoa(
  tenantId: string,
  accountId?: string,
): Promise<SalaryAdvanceResolvedCoa> {
  const piutangKaryawanCoaId = await resolveCoaId(
    tenantId,
    "PIUTANG_KARYAWAN",
  ).then((ids) => ids[0]);

  const kasCoaId = accountId
    ? await findBankCoaByAccountId(tenantId, accountId)
    : await resolveCoaId(tenantId, "KAS_KECIL").then((ids) => ids[0]);

  return { piutangKaryawanCoaId, kasCoaId };
}

export async function resolveInvestorDepositCoa(
  tenantId: string,
  depositType: string,
): Promise<ResolvedCoa> {
  const kasKecilId = await resolveCoaId(tenantId, "KAS_KECIL").then(
    (ids) => ids[0],
  );

  const creditPurpose =
    depositType === "PINJAMAN" ? "HUTANG_INVESTOR" : "MODAL_DISETOR";
  const creditCoaId = await resolveCoaId(tenantId, creditPurpose).then(
    (ids) => ids[0],
  );

  return { debitCoaId: kasKecilId, creditCoaId };
}
