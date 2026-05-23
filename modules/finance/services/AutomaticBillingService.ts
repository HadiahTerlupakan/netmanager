import { logger } from "@/lib/logger";
import { AttendanceSettingsService } from "@/modules/attendance";
import type { PelangganBillingBridgeService } from "@/modules/pelanggan";
import { getPelangganBillingBridge } from "../pelanggan-registry";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { PaymentRepository } from "../repositories/PaymentRepository";
import { BillingInvoiceCreationService } from "./BillingInvoiceCreationService";
import { BillingReminderService } from "./BillingReminderService";
import {
  canGenerateRealtimeInvoice,
  createDueDateRange,
  createTargetBillingDate,
  getBillingBatchSize,
  mapEligibleBillingRowToCustomer,
  mapRealtimeCustomerToBillingPayload,
  parseBillingWindowDays,
  isDueDateWithinBillingWindow,
} from "./automatic-billing.helpers";
import {
  createImmediateInvoice,
  handlePaidInvoiceCustomerState,
} from "./automatic-billing-payment.helpers";

export class AutomaticBillingService {
  private static pelangganBridge: PelangganBillingBridgeService | null = null;
  // Keep the bridge owned by the finance service layer so callers stay decoupled from pelanggan repositories.
  private static invoiceRepo = new InvoiceRepository();
  private static paymentRepo = new PaymentRepository();
  private static invoiceCreationService: BillingInvoiceCreationService | null =
    null;
  private static reminderService: BillingReminderService | null = null;

  private static getPelangganBridge() {
    if (!this.pelangganBridge) {
      this.pelangganBridge = getPelangganBillingBridge();
    }

    return this.pelangganBridge;
  }

  private static getSettingsRepo() {
    return new AttendanceSettingsService();
  }

  private static getInvoiceCreationService() {
    if (!this.invoiceCreationService) {
      this.invoiceCreationService = new BillingInvoiceCreationService(
        this.invoiceRepo,
      );
    }

    return this.invoiceCreationService;
  }

  private static getReminderService() {
    if (!this.reminderService) {
      this.reminderService = new BillingReminderService(
        this.invoiceRepo,
        this.getSettingsRepo(),
      );
    }

    return this.reminderService;
  }

  /** Generate invoices for customers who are due for billing. */
  static async generateDailyInvoices() {
    try {
      const daysBeforeDue = await this.getDaysBeforeDue();
      const targetDate = createTargetBillingDate(new Date(), daysBeforeDue);
      const dueDateRange = createDueDateRange(targetDate);
      const invoiceDueDate = new Date(targetDate);
      const batchSize = getBillingBatchSize();
      let offset = 0;

      while (true) {
        const customers =
          (await this.getPelangganBridge().findEligibleForBilling(
            targetDate.getDate(),
            batchSize,
            offset,
          )) as unknown as Array<Record<string, unknown>>;

        if (customers.length === 0) {
          break;
        }

        await this.processDailyInvoiceBatch(
          customers,
          dueDateRange,
          invoiceDueDate,
        );
        offset += batchSize;
        this.triggerGarbageCollection();
      }
    } catch (error) {
      logger.error("[Billing] Fatal error in generateDailyInvoices:", error);
    }
  }

  /** Mengambil jumlah hari sebelum jatuh tempo untuk generate invoice. */
  private static async getDaysBeforeDue() {
    const invoiceOtomatisSetting = await this.getSettingsRepo().findByKey(
      "GENERAL_INVOICE_OTOMATIS",
    );

    return parseBillingWindowDays(invoiceOtomatisSetting?.value);
  }

  /** Memproses satu batch pelanggan eligible untuk invoice harian. */
  private static async processDailyInvoiceBatch(
    customers: Array<Record<string, unknown>>,
    dueDateRange: { start: Date; end: Date },
    invoiceDueDate: Date,
  ) {
    const existingInvoiceSet = await this.getExistingInvoiceCustomerSet(
      customers.map((customer) => customer.id as string),
      dueDateRange,
    );

    for (const row of customers) {
      await this.processDailyInvoiceCustomer(
        row,
        existingInvoiceSet,
        invoiceDueDate,
      );
    }
  }

  /** Mengambil kumpulan pelanggan yang sudah punya invoice pada due date target. */
  private static async getExistingInvoiceCustomerSet(
    pelangganIds: string[],
    dueDateRange: { start: Date; end: Date },
  ) {
    const existingInvoices =
      await this.invoiceRepo.findManyForDateRangeWithPelangganIds(
        dueDateRange.start,
        dueDateRange.end,
        pelangganIds,
      );

    return new Set(existingInvoices.map((invoice) => invoice.pelangganId));
  }

  /** Memproses generate invoice untuk satu pelanggan dalam batch harian. */
  private static async processDailyInvoiceCustomer(
    row: Record<string, unknown>,
    existingInvoiceSet: Set<string | null>,
    invoiceDueDate: Date,
  ) {
    try {
      if (existingInvoiceSet.has(row.id as string)) {
        return;
      }

      await this.createInvoiceForCustomer(
        mapEligibleBillingRowToCustomer(row as never),
        invoiceDueDate,
      );
    } catch (error) {
      logger.error(`[Billing] Error processing customer ${row.nama}:`, error);
    }
  }

  /** Menjalankan garbage collection antar batch bila tersedia. */
  private static triggerGarbageCollection() {
    if (global.gc) {
      global.gc();
    }
  }

  /** Memeriksa lalu membuat invoice realtime untuk pelanggan tertentu. */
  static async checkAndGenerateRealtimeInvoice(pelangganId: string) {
    try {
      const daysBeforeDue = await this.getDaysBeforeDue();
      const customer =
        await this.getPelangganBridge().findByIdWithHargaPaket(pelangganId);

      if (!canGenerateRealtimeInvoice(customer)) {
        return;
      }

      const jatuhTempo = new Date(customer.jatuhTempo);
      if (!isDueDateWithinBillingWindow(jatuhTempo, daysBeforeDue)) {
        return;
      }

      const dueDateRange = createDueDateRange(jatuhTempo);
      const existingInvoices = await this.invoiceRepo.findManyForExactDueDate(
        customer.id,
        dueDateRange.start,
        dueDateRange.end,
      );

      if (existingInvoices.length > 0) {
        return;
      }

      await this.createInvoiceForCustomer(
        mapRealtimeCustomerToBillingPayload(customer),
        new Date(
          jatuhTempo.getFullYear(),
          jatuhTempo.getMonth(),
          jatuhTempo.getDate(),
        ),
      );
      logger.info(
        `[Billing] Real-time invoice generated for customer ${customer.nama}`,
      );
    } catch (error) {
      logger.error(
        `[Billing] Error in checkAndGenerateRealtimeInvoice for ${pelangganId}:`,
        error,
      );
    }
  }

  /**
   * Generate an invoice immediately regardless of the billing window.
   * Used for Prepaid billing models where invoice must be created at registration.
   */
  static async generateImmediateInvoice(
    pelangganId: string,
    isPaid: boolean = false,
  ) {
    try {
      await createImmediateInvoice({
        pelangganId,
        pelangganBridge: this.getPelangganBridge(),
        invoiceCreationService: this.getInvoiceCreationService(),
        invoiceRepo: this.invoiceRepo,
        paymentRepo: this.paymentRepo,
        shouldMarkPaid: isPaid,
      });
    } catch (error) {
      logger.error(
        `[Billing] Error in generateImmediateInvoice for ${pelangganId}:`,
        error,
      );
    }
  }

  private static async createInvoiceForCustomer(
    customer: {
      id: string;
      nama: string;
      jatuhTempo: Date;
      userId: string | null;
      usePPN: boolean;
      tenantId: string | null;
      hargaPaket: {
        id: string;
        name: string;
        harga: number;
        usePPN: boolean;
        ppnPercentage: number | null;
      };
    },
    dueDate: Date,
  ) {
    return this.getInvoiceCreationService().createInvoiceForCustomer(
      customer,
      dueDate,
    );
  }

  /**
   * Update jatuhTempo and status when an invoice is fully paid.
   * Call this from webhook or manual payment handlers.
   */
  static async handleInvoicePaid(invoiceId: string) {
    await handlePaidInvoiceCustomerState({
      invoiceId,
      invoiceRepo: this.invoiceRepo,
      pelangganBridge: this.getPelangganBridge(),
    });
  }

  /**
   * Send payment reminders for unpaid invoices based on settings.
   * Called periodically (e.g. every minute) to check if the current time matches the reminderTime setting.
   */
  static async sendDailyReminders() {
    return this.getReminderService().sendDailyReminders();
  }
}
