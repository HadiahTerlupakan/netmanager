import { logger } from "@/lib/logger";
import { getAutoIsolationSettings } from "@/modules/settings";
import {
  getPelangganBillingBridge,
  getPelangganServiceFromRegistry,
} from "../pelanggan-registry";
import type {
  IInvoiceRepository,
  InvoiceWithPayment,
} from "../domain/ports/IInvoiceRepository";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { Status } from "../types/invoice.enums";

function getInvoiceRepository(): IInvoiceRepository {
  return new InvoiceRepository();
}

/** Mengeksekusi auto-isolir pelanggan secara idempotent. */
export class AutomaticIsolationExecutionService {
  constructor(
    private readonly invoiceRepository: IInvoiceRepository = getInvoiceRepository(),
    private readonly pelangganBridge = getPelangganBillingBridge(),
  ) {}

  async execute(
    options: { invoiceId: string; pelangganId: string },
    now: Date = new Date(),
  ): Promise<boolean> {
    const settings = await getAutoIsolationSettings();
    if (!settings.enabled) {
      logger.info(
        `[AutomaticIsolationExecution] Skip pelanggan ${options.pelangganId}; auto isolir disabled`,
      );
      return false;
    }

    const [invoice, pelanggan] = await Promise.all([
      this.invoiceRepository.findWithPayment(options.invoiceId),
      this.pelangganBridge.findById(options.pelangganId),
    ]);

    if (!invoice || !pelanggan) {
      logger.warn(
        `[AutomaticIsolationExecution] Missing invoice ${options.invoiceId} or pelanggan ${options.pelangganId}`,
      );
      return false;
    }

    if (pelanggan.status !== Status.AKTIF || !pelanggan.autoIsolir) {
      logger.info(
        `[AutomaticIsolationExecution] Skip pelanggan ${pelanggan.id}; status ${pelanggan.status}, autoIsolir ${pelanggan.autoIsolir}`,
      );
      return false;
    }

    if (!this.isInvoiceEligible(invoice, now)) {
      logger.info(
        `[AutomaticIsolationExecution] Skip invoice ${invoice.id}; status ${invoice.status}`,
      );
      return false;
    }

    await getPelangganServiceFromRegistry().updateStatusPelanggan(
      pelanggan.id,
      Status.ISOLIR,
    );

    await logger.logActivity({
      action: "UPDATE",
      subject: "Pelanggan (Auto Isolir)",
      details: {
        id: pelanggan.id,
        name: pelanggan.nama,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        nextStatus: Status.ISOLIR,
      },
    });

    logger.info(
      `[AutomaticIsolationExecution] Isolated pelanggan ${pelanggan.id} for invoice ${invoice.id}`,
    );
    return true;
  }

  private isInvoiceEligible(invoice: InvoiceWithPayment, now: Date): boolean {
    if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
      return false;
    }

    if (invoice.paidAmount >= invoice.totalAmount) {
      return false;
    }

    return (
      invoice.status === "OVERDUE" || invoice.dueDate.getTime() <= now.getTime()
    );
  }
}
