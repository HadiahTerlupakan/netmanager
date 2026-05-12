import type { InvoiceEntity } from "../domain/entities/InvoiceEntity";
import { AutomaticIsolationSchedulerService } from "./AutomaticIsolationSchedulerService";
import { InvoiceOverdueSchedulerService } from "./InvoiceOverdueSchedulerService";

/** Menyinkronkan seluruh durable billing schedule untuk sebuah invoice. */
export async function syncInvoiceBillingSchedules(
  invoice: Pick<InvoiceEntity, "id" | "dueDate" | "status" | "pelangganId">,
): Promise<void> {
  await new InvoiceOverdueSchedulerService().syncForInvoice(invoice);
  await new AutomaticIsolationSchedulerService().syncForInvoice(invoice);
}

/** Membatalkan seluruh durable billing schedule untuk sebuah invoice. */
export async function cancelInvoiceBillingSchedules(
  invoiceId: string,
): Promise<void> {
  await new InvoiceOverdueSchedulerService().cancel(invoiceId);
  await new AutomaticIsolationSchedulerService().cancel(invoiceId);
}
