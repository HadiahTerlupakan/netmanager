import type { Prisma } from "@prisma/client";

const INVOICE_COMMISSION_LOCK_PREFIX = "reseller-commission:";
const RESELLER_ADJUSTMENT_LOCK_PREFIX = "reseller-adjustment:";

/**
 * Serialkan semua perubahan komisi satu invoice (akru, pembatalan, koreksi).
 * Unique (tenantId, invoiceId) tidak berlaku bila tenantId NULL, jadi kunci
 * inilah penjaga utamanya.
 */
export async function lockInvoiceCommission(
  tx: Prisma.TransactionClient,
  invoiceId: string,
): Promise<void> {
  const lockKey = `${INVOICE_COMMISSION_LOCK_PREFIX}${invoiceId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
}

/**
 * Serialkan pemakaian koreksi satu reseller: pembuatan settlement dan
 * penghitungan ulang settlement yang komisinya dikeluarkan sama-sama membaca
 * sisa koreksi lalu memotongnya. Tanpa kunci ini dua transaksi bisa memotong
 * sisa yang sama dua kali.
 */
export async function lockResellerAdjustments(
  tx: Prisma.TransactionClient,
  resellerId: string,
): Promise<void> {
  const lockKey = `${RESELLER_ADJUSTMENT_LOCK_PREFIX}${resellerId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
}
