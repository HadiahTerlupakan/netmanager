import { FinanceRepositoryFacade } from "@/modules/finance";
import type { IInvoicePaymentStatusReader } from "../domain/ports/IInvoicePaymentStatusReader";

const PAID_STATUS = "PAID";

/** Membaca status invoice lewat public API modul finance. */
export class FinanceInvoicePaymentStatusReader implements IInvoicePaymentStatusReader {
  /** True bila invoice ada dan saat ini berstatus PAID. */
  async isPaid(invoiceId: string): Promise<boolean> {
    const invoice =
      await FinanceRepositoryFacade.createInvoiceRepository().findRawById(
        invoiceId,
      );
    return invoice?.status === PAID_STATUS;
  }
}
