import type { InvoiceEntity } from "../domain/entities/InvoiceEntity";
import { BillingScheduleService } from "./BillingScheduleService";

/** Menjaga schedule overdue invoice tetap sinkron dengan lifecycle invoice. */
export class InvoiceOverdueSchedulerService {
  constructor(
    private readonly billingScheduleService = new BillingScheduleService(),
  ) {}

  async syncForInvoice(
    invoice: Pick<InvoiceEntity, "id" | "dueDate" | "status" | "pelangganId">,
  ): Promise<void> {
    if (!this.isEligible(invoice.status)) {
      await this.cancel(invoice.id);
      return;
    }

    await this.billingScheduleService.schedule({
      dedupeKey: buildInvoiceOverdueDedupeKey(invoice.id),
      jobType: "INVOICE_MARK_OVERDUE",
      invoiceId: invoice.id,
      pelangganId: invoice.pelangganId,
      runAt: new Date(invoice.dueDate),
    });
  }

  async cancel(invoiceId: string): Promise<void> {
    await this.billingScheduleService.cancel(
      buildInvoiceOverdueDedupeKey(invoiceId),
    );
  }

  private isEligible(status: string): boolean {
    return status === "SENT" || status === "PARTIAL_PAID";
  }
}

export function buildInvoiceOverdueDedupeKey(invoiceId: string): string {
  return `invoice-overdue:${invoiceId}`;
}
