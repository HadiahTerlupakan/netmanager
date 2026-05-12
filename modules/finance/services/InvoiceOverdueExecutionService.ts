import { logger } from "@/lib/logger";
import type { IInvoiceRepository } from "../domain/ports/IInvoiceRepository";
import { InvoiceRepository } from "../repositories/InvoiceRepository";

function getInvoiceRepository(): IInvoiceRepository {
  return new InvoiceRepository();
}

/** Mengeksekusi transisi invoice ke OVERDUE secara idempotent. */
export class InvoiceOverdueExecutionService {
  constructor(
    private readonly invoiceRepository: IInvoiceRepository = getInvoiceRepository(),
  ) {}

  async execute(invoiceId: string, now: Date = new Date()): Promise<boolean> {
    const invoice = await this.invoiceRepository.findRawById(invoiceId);
    if (!invoice) {
      logger.warn(
        `[InvoiceOverdueExecution] Invoice ${invoiceId} tidak ditemukan`,
      );
      return false;
    }

    const changed = await this.invoiceRepository.markOverdueIfEligible(
      invoiceId,
      now,
    );

    if (!changed) {
      logger.info(
        `[InvoiceOverdueExecution] Skip invoice ${invoiceId}; status ${invoice.status}`,
      );
      return false;
    }

    await logger.logActivity({
      action: "UPDATE",
      subject: "Invoice (Auto Overdue)",
      details: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        previousStatus: invoice.status,
        nextStatus: "OVERDUE",
      },
    });

    logger.info(
      `[InvoiceOverdueExecution] Marked invoice ${invoiceId} as OVERDUE`,
    );
    return true;
  }
}
