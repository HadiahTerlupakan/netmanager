import { PelangganBillingBridgeService } from "@/modules/pelanggan";
import { getAutoIsolationSettings } from "@/modules/settings";
import type { InvoiceEntity } from "../domain/entities/InvoiceEntity";
import { Status } from "../types/invoice.enums";
import { BillingScheduleService } from "./BillingScheduleService";

/** Menjaga schedule auto-isolir tetap sinkron dengan lifecycle invoice. */
export class AutomaticIsolationSchedulerService {
  constructor(
    private readonly billingScheduleService = new BillingScheduleService(),
    private readonly pelangganBridge = new PelangganBillingBridgeService(),
  ) {}

  async syncForInvoice(
    invoice: Pick<InvoiceEntity, "id" | "dueDate" | "status" | "pelangganId">,
  ): Promise<void> {
    if (!invoice.pelangganId || !this.isInvoiceEligible(invoice.status)) {
      await this.cancel(invoice.id);
      return;
    }

    const settings = await getAutoIsolationSettings();
    if (!settings.enabled) {
      await this.cancel(invoice.id);
      return;
    }

    const pelanggan = await this.pelangganBridge.findById(invoice.pelangganId);
    if (
      !pelanggan ||
      pelanggan.status !== Status.AKTIF ||
      !pelanggan.autoIsolir
    ) {
      await this.cancel(invoice.id);
      return;
    }

    const runAt = new Date(invoice.dueDate);
    runAt.setDate(runAt.getDate() + settings.toleranceDays);

    await this.billingScheduleService.schedule({
      dedupeKey: buildAutomaticIsolationDedupeKey(invoice.id),
      jobType: "CUSTOMER_AUTO_ISOLIR",
      invoiceId: invoice.id,
      pelangganId: invoice.pelangganId,
      runAt,
    });
  }

  async cancel(invoiceId: string): Promise<void> {
    await this.billingScheduleService.cancel(
      buildAutomaticIsolationDedupeKey(invoiceId),
    );
  }

  private isInvoiceEligible(status: string): boolean {
    return (
      status === "SENT" || status === "PARTIAL_PAID" || status === "OVERDUE"
    );
  }
}

export function buildAutomaticIsolationDedupeKey(invoiceId: string): string {
  return `customer-auto-isolir:${invoiceId}`;
}
