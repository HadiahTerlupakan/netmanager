import { prisma } from "@/lib/prisma";
import { CoaNotFoundError } from "../../errors";

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
  return findCoaByCode(tenantId, "1-110");
}

export async function resolveInvoiceCreatedCoa(
  tenantId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await Promise.all([
    findCoaByCode(tenantId, "1-200"),
    findCoaByCode(tenantId, "4-100"),
  ]);
  return { debitCoaId, creditCoaId };
}

export async function resolveInvoicePaidCoa(
  tenantId: string,
  accountId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await Promise.all([
    findBankCoaByAccountId(tenantId, accountId),
    findCoaByCode(tenantId, "1-200"),
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
    category?.coaId ?? (await findCoaByCode(tenantId, "5-500"));
  const creditCoaId = await findBankCoaByAccountId(tenantId, accountId);

  return { debitCoaId, creditCoaId };
}

export async function resolvePurchaseOrderPaidCoa(
  tenantId: string,
  accountId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await Promise.all([
    findCoaByCode(tenantId, "1-300"),
    findBankCoaByAccountId(tenantId, accountId),
  ]);
  return { debitCoaId, creditCoaId };
}

export async function resolveCouponUsedCoa(
  tenantId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await Promise.all([
    findCoaByCode(tenantId, "4-300"),
    findCoaByCode(tenantId, "1-200"),
  ]);
  return { debitCoaId, creditCoaId };
}

export async function resolveMitraWithdrawalCoa(
  tenantId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await Promise.all([
    findCoaByCode(tenantId, "5-800"),
    findCoaByCode(tenantId, "1-120"),
  ]);
  return { debitCoaId, creditCoaId };
}

export async function resolveInvestorPayoutCoa(
  tenantId: string,
): Promise<ResolvedCoa> {
  const [debitCoaId, creditCoaId] = await Promise.all([
    findCoaByCode(tenantId, "5-810"),
    findCoaByCode(tenantId, "1-120"),
  ]);
  return { debitCoaId, creditCoaId };
}

export async function resolveInvestorDepositCoa(
  tenantId: string,
  depositType: string,
): Promise<ResolvedCoa> {
  // DR Kas/Bank (1-120) selalu
  const debitCoaId = await findCoaByCode(tenantId, "1-120");

  // CR tergantung tipe deposit:
  // PINJAMAN → Hutang Investor (2-600)
  // MODAL_AWAL / TAMBAHAN_MODAL → Modal Disetor (3-100)
  const creditCode = depositType === "PINJAMAN" ? "2-600" : "3-100";
  const creditCoaId = await findCoaByCode(tenantId, creditCode);

  return { debitCoaId, creditCoaId };
}
