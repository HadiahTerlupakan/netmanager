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
  createBillingCatchUpRange,
  createDueDateRange,
  createExistingInvoiceKey,
  getBillingBatchSize,
  mapEligibleBillingRowToCustomer,
  mapRealtimeCustomerToBillingPayload,
  parseBillingWindowDays,
  isDueDateWithinBillingWindow,
  resolveInvoiceDueDate,
} from "./automatic-billing.helpers";
import type {
  BillingCustomerPayload,
  EligibleBillingRow,
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

  /**
   * Generate invoice untuk pelanggan yang jatuh temponya masuk window billing.
   *
   * Window punya batas bawah beberapa hari ke belakang, jadi jatuh tempo yang
   * terlewat karena cron mati tetap terkejar pada run berikutnya. Dedupe
   * dilakukan per (pelanggan, jatuh tempo miliknya) sehingga pelanggan
   * menunggak tidak ditagih ulang tiap hari.
   */
  static async generateDailyInvoices() {
    try {
      const daysBeforeDue = await this.getDaysBeforeDue();
      const billingRange = createBillingCatchUpRange(new Date(), daysBeforeDue);
      const batchSize = getBillingBatchSize();
      let offset = 0;

      let hasMoreBatches = true;
      while (hasMoreBatches) {
        const customers =
          await this.getPelangganBridge().findEligibleForBilling(
            billingRange.start,
            billingRange.end,
            batchSize,
            offset,
          );

        if (customers.length === 0) {
          break;
        }

        await this.processDailyInvoiceBatch(customers, billingRange);
        // Batch tidak penuh berarti sudah halaman terakhir — hemat satu query.
        hasMoreBatches = customers.length === batchSize;
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
    customers: EligibleBillingRow[],
    billingRange: { start: Date; end: Date },
  ) {
    const existingInvoiceKeys = await this.getExistingInvoiceKeys(
      customers.map((customer) => customer.id),
      billingRange,
    );

    for (const row of customers) {
      await this.processDailyInvoiceCustomer(row, existingInvoiceKeys);
    }
  }

  /**
   * Kunci (pelanggan, tanggal jatuh tempo) yang sudah punya invoice.
   * Dedupe harus per siklus pelanggan, bukan per tanggal target global.
   */
  private static async getExistingInvoiceKeys(
    pelangganIds: string[],
    billingRange: { start: Date; end: Date },
  ) {
    const existingInvoices =
      await this.invoiceRepo.findManyForDateRangeWithPelangganIds(
        billingRange.start,
        billingRange.end,
        pelangganIds,
      );

    return new Set(
      existingInvoices.map((invoice) =>
        createExistingInvoiceKey(invoice.pelangganId, invoice.dueDate),
      ),
    );
  }

  /** Memproses generate invoice untuk satu pelanggan dalam batch harian. */
  private static async processDailyInvoiceCustomer(
    row: EligibleBillingRow,
    existingInvoiceKeys: Set<string>,
  ) {
    try {
      const invoiceDueDate = resolveInvoiceDueDate(new Date(row.jatuhTempo));
      if (
        existingInvoiceKeys.has(
          createExistingInvoiceKey(row.id, invoiceDueDate),
        )
      ) {
        return;
      }

      await this.createInvoiceForCustomer(
        mapEligibleBillingRowToCustomer(row),
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
      return await createImmediateInvoice({
        pelangganId,
        pelangganBridge: this.getPelangganBridge(),
        invoiceCreationService: this.getInvoiceCreationService(),
        invoiceRepo: this.invoiceRepo,
        paymentRepo: this.paymentRepo,
        shouldMarkPaid: isPaid,
      });
    } catch (error) {
      // Error di-log lalu dilempar ulang supaya pemanggil yang menentukan
      // kebijakan, bukan service ini. Menelan error di sini membuat pelanggan
      // berakhir tanpa tagihan tanpa satu pun sinyal ke operator. Kedua
      // pemanggil sudah menangani secara eksplisit: registrasi non-fatal, dan
      // update admin melaporkannya lewat flag di response.
      logger.error(
        `[Billing] Error in generateImmediateInvoice for ${pelangganId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Membatalkan tagihan hidup pelanggan lalu menerbitkan penggantinya.
   *
   * Mendukung aksi admin "Batalkan & Buat Tagihan Baru": sebelumnya alur itu
   * hanya membuat tagihan baru sehingga tagihan lama tetap hidup dan pelanggan
   * berakhir dengan dua tagihan. Pembatalan dijalankan lebih dulu dan tidak
   * ditelan — kalau gagal, tagihan pengganti tidak dibuat supaya tidak
   * menambah tagihan ganda.
   */
  static async replaceOutstandingInvoice(pelangganId: string) {
    const { replaceOutstandingInvoiceForCustomer } =
      await import("./outstanding-invoice.helpers");

    return replaceOutstandingInvoiceForCustomer({
      pelangganId,
      invoiceRepo: this.invoiceRepo,
      createInvoice: () =>
        createImmediateInvoice({
          pelangganId,
          pelangganBridge: this.getPelangganBridge(),
          invoiceCreationService: this.getInvoiceCreationService(),
          invoiceRepo: this.invoiceRepo,
          paymentRepo: this.paymentRepo,
          shouldMarkPaid: false,
        }),
    });
  }

  private static async createInvoiceForCustomer(
    customer: BillingCustomerPayload,
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
