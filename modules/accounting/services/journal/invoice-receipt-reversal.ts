import { prisma } from "@/lib/prisma";
import { JournalRepository } from "../../repositories/JournalRepository";
import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { PeriodRepository } from "../../repositories/PeriodRepository";
import { JournalReverseService } from "./JournalReverseService";

/**
 * Referensi jurnal penerimaan sebuah pelunasan. Kunci jurnal otomatis unik per
 * (tenant, sumber, referensi): dengan id invoice saja, invoice yang dibayar
 * ulang setelah pembayarannya dibatalkan tidak akan pernah mendapat jurnal
 * penerimaan baru. Pembayaran terakhir membedakan tiap pelunasan, dan tetap
 * sama saat event yang sama diulang.
 */
export function invoiceReceiptRef(invoiceId: string, paymentId: string) {
  return `${invoiceId}:${paymentId}`;
}

/**
 * Balik jurnal penerimaan invoice yang pelunasannya dibatalkan, agar kas dan
 * piutang kembali seperti sebelum dibayar. Jurnal lama memakai id invoice
 * saja sebagai referensi, jadi keduanya dicari.
 */
export async function reverseInvoiceReceiptJournals(input: {
  tenantId: string;
  invoiceId: string;
  reason: string;
  reversedBy: string;
}) {
  const entries = await prisma.journalEntry.findMany({
    where: {
      tenantId: input.tenantId,
      source: "AUTO_INVOICE_PAID",
      status: "POSTED",
      OR: [
        { sourceRefId: input.invoiceId },
        { sourceRefId: { startsWith: `${input.invoiceId}:` } },
      ],
    },
    select: { id: true },
  });
  const reverser = new JournalReverseService(
    new JournalRepository(),
    new ChartOfAccountRepository(),
    new PeriodRepository(),
  );
  for (const entry of entries) {
    await reverser.reverse(entry.id, input.reason, input.reversedBy);
  }
  return entries.length;
}
