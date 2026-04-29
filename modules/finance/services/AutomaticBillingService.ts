import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { toStartOfDay, toEndOfDay } from "@/lib/utils/server-datetime";
import { BillingEventDispatcher } from "@/modules/events";
import { AttendanceSettingsService } from "@/modules/attendance";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { PaymentRepository } from "../repositories/PaymentRepository";
import { BillingInvoiceCreationService } from "./BillingInvoiceCreationService";
import { BillingReminderService } from "./BillingReminderService";
import {
  getPelangganService,
  PelangganBillingBridgeService,
} from "@/modules/pelanggan";

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
      this.pelangganBridge = new PelangganBillingBridgeService();
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
        this.getSettingsRepo(),
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
   * Generate invoices for customers who are due for billing
   * run daily via cron
   * OPTIMIZED: Filter by day-of-month at database level using raw query
   * instead of fetching all customers and filtering in JavaScript
   */
  static async generateDailyInvoices() {
    try {
      // 1. Get settings
      const invoiceOtomatisSetting = await this.getSettingsRepo().findByKey(
        "GENERAL_INVOICE_OTOMATIS",
      );

      const daysBeforeDue = parseInt(invoiceOtomatisSetting?.value || "5");

      const pelangganBridge = this.getPelangganBridge();

      const createDueEnd = (date: Date) =>
        new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          23,
          59,
          59,
        );
      const createDueStart = (date: Date) =>
        new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
      void createDueEnd;
      void createDueStart;
      void pelangganBridge;

      // Calculate target date
      const today = new Date();
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysBeforeDue);

      const targetDay = targetDate.getDate();
      const targetMonth = targetDate.getMonth() + 1;
      const targetYear = targetDate.getFullYear();

      // OPTIMIZATION: Use raw query to filter by day-of-month at database level
      const BATCH_SIZE = 100;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const customers =
          await this.getPelangganBridge().findEligibleForBilling(
            targetDay,
            BATCH_SIZE,
            offset,
          );

        if (customers.length === 0) {
          hasMore = false;
          break;
        }

        // OPTIMIZATION: Batch check existing invoices (instead of N queries)
        const eligibleIds = customers.map((c) => c.id);
        const existingInvoices =
          await this.invoiceRepo.findManyForDateRangeWithPelangganIds(
            new Date(targetYear, targetMonth - 1, targetDay, 0, 0, 0),
            new Date(targetYear, targetMonth - 1, targetDay, 23, 59, 59),
            eligibleIds,
          );
        const existingInvoiceSet = new Set(
          existingInvoices.map((i) => i.pelangganId),
        );

        const invoiceDueDate = new Date(targetYear, targetMonth - 1, targetDay);

        for (const row of customers) {
          try {
            // Skip if invoice already exists (O(1) lookup)
            if (existingInvoiceSet.has(row.id)) {
              continue;
            }

            // Map raw query row to customer object
            const customer = {
              id: row.id,
              nama: row.nama,
              jatuhTempo: row.jatuhTempo,
              userId: row.userId,
              usePPN: row.usePPN,
              tipe: row.tipe,
              status: row.status,
              hargaPaket: {
                id: row.hargaPaketId,
                name: row.paketName,
                harga: row.paketHarga,
                usePPN: row.paketUsePPN,
                ppnPercentage: row.paketPpnPercentage,
              },
            };

            // Generate Invoice
            await this.createInvoiceForCustomer(customer, invoiceDueDate);
          } catch (err) {
            logger.error(
              `[Billing] Error processing customer ${row.nama}:`,
              err,
            );
          }
        }

        offset += BATCH_SIZE;

        // Force garbage collection between batches if available
        if (global.gc) {
          global.gc();
        }
      }
    } catch (error) {
      logger.error("[Billing] Fatal error in generateDailyInvoices:", error);
    }
  }

  /**
   * Check if a specific customer needs an invoice right now (e.g., after creation/edit)
   * where their jatuhTempo is less than or equal to the daysBeforeDue window.
   */
  static async checkAndGenerateRealtimeInvoice(pelangganId: string) {
    try {
      // 1. Get settings for daysBeforeDue
      const invoiceOtomatisSetting = await this.getSettingsRepo().findByKey(
        "GENERAL_INVOICE_OTOMATIS",
      );
      const daysBeforeDue = parseInt(invoiceOtomatisSetting?.value || "5");

      // 2. Fetch customer
      const customer =
        await this.getPelangganBridge().findByIdWithHargaPaket(pelangganId);

      if (
        !customer ||
        !customer.hargaPaket ||
        (customer.status !== "AKTIF" && customer.status !== "ISOLIR")
      ) {
        return;
      }
      if (customer.status === "ISOLIR" && customer.tipe !== "REGULER") {
        return;
      }

      // 3. Check if date is within window
      const today = new Date();
      today.setTime(toStartOfDay(today).getTime());

      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysBeforeDue);
      targetDate.setTime(toEndOfDay(targetDate).getTime());

      const jatuhTempo = new Date(customer.jatuhTempo);

      // If their exact next due date is outside our generation window, do nothing.
      if (jatuhTempo > targetDate) {
        return;
      }

      // 4. Check if an invoice for this exact due date period already exists
      const dueYear = jatuhTempo.getFullYear();
      const dueMonth = jatuhTempo.getMonth();
      const dueDay = jatuhTempo.getDate();

      const existingInvoices = await this.invoiceRepo.findManyForExactDueDate(
        customer.id,
        new Date(dueYear, dueMonth, dueDay, 0, 0, 0),
        new Date(dueYear, dueMonth, dueDay, 23, 59, 59),
      );

      if (existingInvoices.length > 0) {
        return; // Invoice already exists for this date
      }

      const invoiceDueDate = new Date(dueYear, dueMonth, dueDay);

      const customerPayload = {
        id: customer.id,
        nama: customer.nama,
        jatuhTempo: customer.jatuhTempo,
        userId: customer.userId,
        usePPN: customer.usePPN,
        hargaPaket: {
          id: customer.hargaPaket.id,
          name: customer.hargaPaket.name,
          harga: customer.hargaPaket.harga,
          usePPN: customer.hargaPaket.usePPN,
          ppnPercentage: customer.hargaPaket.ppnPercentage,
        },
      };

      await this.createInvoiceForCustomer(customerPayload, invoiceDueDate);
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
      // 1. Fetch customer
      const customer =
        await this.getPelangganBridge().findByIdWithHargaPaket(pelangganId);

      if (!customer || !customer.hargaPaket) {
        return;
      }

      // For immediate prepaid invoice, due date is today
      const today = new Date();

      const customerPayload = {
        id: customer.id,
        nama: customer.nama,
        jatuhTempo: customer.jatuhTempo,
        userId: customer.userId,
        usePPN: customer.usePPN,
        hargaPaket: {
          id: customer.hargaPaket.id,
          name: customer.hargaPaket.name,
          harga: customer.hargaPaket.harga,
          usePPN: customer.hargaPaket.usePPN,
          ppnPercentage: customer.hargaPaket.ppnPercentage,
        },
      };

      const invoice = await this.createInvoiceForCustomer(
        customerPayload,
        today,
      );

      // If it should be marked as paid immediately:
      if (isPaid && invoice) {
        await this.invoiceRepo.update(invoice.id, {
          status: "PAID",
          paidAmount: invoice.totalAmount,
        });

        // Note: We deliberately do NOT call handleInvoicePaid here because
        // for a new customer registration, the jatuhTempo is already set to the end of the first period.
        // Calling handleInvoicePaid would incorrectly push it by another month.

        // We create a payment record to make it complete
        await this.paymentRepo.create({
          id: randomUUID(),
          pelangganId: pelangganId,
          invoiceId: invoice.id,
          amount: invoice.totalAmount,
          paymentDate: new Date(),
          paymentMethod: "CASH",
          reference: "REGISTRATION_PAYMENT",
          verifiedAt: new Date(),
          verifiedBy: "SYSTEM",
          notes: "Pembayaran otomatis pada saat registrasi pelanggan",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await BillingEventDispatcher.onInvoicePaid(
          invoice.id,
          pelangganId,
          Number(invoice.totalAmount),
        ).catch((err) =>
          logger.error(
            "Failed to publish INVOICE_PAID event",
            err instanceof Error ? err : undefined,
          ),
        );
      }

      logger.info(
        `[Billing] Immediate invoice generated for customer ${customer.nama}, isPaid: ${isPaid}`,
      );
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
    const invoice = await this.invoiceRepo.findUnique(invoiceId);

    if (!invoice || invoice.status !== "PAID") return;

    const customer = await this.getPelangganBridge().findById(
      invoice.pelangganId,
    );
    if (!customer) return;

    const today = new Date();
    today.setTime(toStartOfDay(today).getTime());

    const safeAddMonth = (date: Date) => {
      const d = new Date(date);
      const day = d.getDate();
      d.setMonth(d.getMonth() + 1);
      if (d.getDate() !== day) {
        d.setDate(0);
      }
      return d;
    };

    let newJatuhTempo = new Date(customer.jatuhTempo);

    if (customer.tipe === "NON_REGULER") {
      const baseDate =
        customer.status === "ISOLIR" || new Date(customer.jatuhTempo) < today
          ? today
          : new Date(customer.jatuhTempo);
      newJatuhTempo = safeAddMonth(baseDate);
    } else {
      newJatuhTempo = safeAddMonth(invoice.dueDate);
      if (newJatuhTempo < customer.jatuhTempo) {
        newJatuhTempo = new Date(customer.jatuhTempo);
      }
    }

    const unpaidInvoices = await this.invoiceRepo.countUnpaidByPelangganId(
      customer.id,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: any = {
      jatuhTempo: newJatuhTempo,
    };

    let shouldActivate = false;

    if (customer.tipe === "REGULER") {
      if (unpaidInvoices === 0 && customer.status !== "AKTIF") {
        updates.status = "AKTIF";
        shouldActivate = true;
      }
    } else {
      if (customer.status !== "AKTIF") {
        updates.status = "AKTIF";
        shouldActivate = true;
      }
    }

    await this.getPelangganBridge().updateJatuhTempo(
      customer.id,
      newJatuhTempo,
    );
    if (shouldActivate) {
      await getPelangganService().updateStatusPelanggan(customer.id, "AKTIF");
    }

    // Publish domain event
    await BillingEventDispatcher.onInvoicePaid(
      invoiceId,
      customer.id,
      Number(invoice.totalAmount),
    ).catch((err) =>
      logger.error(
        "Failed to publish INVOICE_PAID event",
        err instanceof Error ? err : undefined,
      ),
    );
  }

  /**
   * Send payment reminders for unpaid invoices based on settings.
   * Called periodically (e.g. every minute) to check if the current time matches the reminderTime setting.
   */
  static async sendDailyReminders() {
    return this.getReminderService().sendDailyReminders();
  }
}
