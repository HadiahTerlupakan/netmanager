import {
  FinanceRepositoryFacade,
  readSaldoKreditUsed,
} from "@/modules/finance";
import type {
  IInvoicePaymentStatusReader,
  PaidInvoiceAmounts,
} from "../domain/ports/IInvoicePaymentStatusReader";

const PAID_STATUS = "PAID";

/** Membaca status invoice lewat public API modul finance. */
export class FinanceInvoicePaymentStatusReader implements IInvoicePaymentStatusReader {
  /** True bila invoice ada dan saat ini berstatus PAID. */
  async isPaid(invoiceId: string): Promise<boolean> {
    return (await this.findPaidAmounts(invoiceId)) !== null;
  }

  /** Nominal invoice PAID (total, PPN, saldo kredit terpakai); null bila tidak lunas. */
  async findPaidAmounts(invoiceId: string): Promise<PaidInvoiceAmounts | null> {
    const invoice =
      await FinanceRepositoryFacade.createInvoiceRepository().findRawById(
        invoiceId,
      );
    if (invoice?.status !== PAID_STATUS) return null;
    return {
      totalAmount: Number(invoice.totalAmount),
      taxAmount: Number(invoice.taxAmount),
      saldoKreditUsed: Number(readSaldoKreditUsed(invoice)),
    };
  }
}
