import { prisma } from "@/lib/prisma";
import { resolveExpenseApprovedCoa } from "../event-handlers/coa-resolver";
import {
  autoPostingService,
  ensurePeriod,
  journalReverseService,
} from "./auto-posting";

/**
 * Jurnal pengeluaran yang dicatat dari menu Pengeluaran.
 *
 * Pengeluaran dari pembayaran PO, pembelian aset, dan penyusutan punya
 * jurnalnya sendiri, jadi tidak dijurnal di sini: penyusutan tidak
 * mengeluarkan kas, dan PO sudah mengkredit bank lewat jurnal pembayarannya.
 */

const SOURCE = "AUTO_EXPENSE";

function expenseRefs(expenseId: string) {
  return [
    { sourceRefId: expenseId },
    { sourceRefId: { startsWith: `${expenseId}:` } },
  ];
}

async function expenseLines(
  tenantId: string,
  expense: {
    amount: bigint;
    accountId: string | null;
    expenseCategoryId: string | null;
  },
) {
  const { debitCoaId, creditCoaId } = await resolveExpenseApprovedCoa(
    tenantId,
    expense.expenseCategoryId,
    expense.accountId,
  );
  const amount = expense.amount.toString();
  return [
    { coaId: debitCoaId, side: "DEBIT" as const, amount },
    { coaId: creditCoaId, side: "CREDIT" as const, amount },
  ];
}

/** Debit beban, Kredit rekening sumber dana (Kas bila tanpa rekening). */
export async function postExpenseJournal(
  tenantId: string,
  expenseId: string,
  sourceRefId = expenseId,
) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: {
      amount: true,
      date: true,
      accountId: true,
      expenseCategoryId: true,
      description: true,
      category: true,
    },
  });
  if (!expense || expense.amount <= 0n) return false;

  await ensurePeriod(tenantId, expense.date);
  await autoPostingService().postAuto(tenantId, {
    source: SOURCE,
    sourceRefType: "Expense",
    sourceRefId,
    entryDate: expense.date,
    description: `Pengeluaran: ${expense.description || expense.category}`,
    lines: await expenseLines(tenantId, expense),
  });
  return true;
}

/**
 * Samakan jurnal dengan pengeluaran setelah diubah atau dihapus: jurnal lama
 * dibalik, lalu yang baru diposting dari data terkini. Dulu jumlah atau
 * rekening yang dikoreksi tidak pernah sampai ke pembukuan, dan pengeluaran
 * yang dihapus tetap tercatat sebagai uang keluar.
 */
export async function resyncExpenseJournal(input: {
  tenantId: string;
  expenseId: string;
  reason: string;
  actor: string;
}) {
  const entries = await prisma.journalEntry.findMany({
    where: {
      tenantId: input.tenantId,
      source: SOURCE,
      OR: expenseRefs(input.expenseId),
    },
    select: { id: true, status: true },
  });
  const active = entries.filter((entry) => entry.status === "POSTED");
  // Pengeluaran yang tidak pernah dijurnal di sini (PO, aset, penyusutan)
  // dibiarkan: pembukuannya diurus alurnya sendiri.
  if (active.length === 0) return false;

  // Jurnal baru diposting sebelum yang lama dibalik: bila posting gagal
  // (periode tertutup, COA hilang) jurnal lama tetap berdiri dan edit
  // berikutnya masih bisa menyamakannya. Kunci jurnal ke-n berakhiran :n.
  await postExpenseJournal(
    input.tenantId,
    input.expenseId,
    `${input.expenseId}:${entries.length}`,
  );
  await ensurePeriod(input.tenantId, new Date());
  const reverser = journalReverseService();
  for (const entry of active) {
    await reverser.reverse(entry.id, input.reason, input.actor);
  }
  return true;
}
