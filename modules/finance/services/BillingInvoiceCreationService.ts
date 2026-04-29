import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { sendCustomerPushNotification } from "@/modules/notification";
import { AttendanceSettingsService } from "@/modules/attendance";
import { notifyCustomerFinanceNotification } from "../utils/customerFinanceNotifications";
import { InvoiceRepository } from "../repositories/InvoiceRepository";

type BillingCustomerPayload = {
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
};

export class BillingInvoiceCreationService {
  constructor(
    private readonly invoiceRepo = new InvoiceRepository(),
    private readonly settingsRepo = new AttendanceSettingsService(),
  ) {}

  /** Create invoice and send customer notifications. */
  async createInvoiceForCustomer(
    customer: BillingCustomerPayload,
    dueDate: Date,
  ) {
    const invoice = await this.invoiceRepo.create({
      ...this.buildInvoicePayload(customer, dueDate),
      invoiceItem: {
        create: [this.buildInvoiceItemPayload(customer)],
      },
    });

    await this.notifyInvoiceCreated(customer, invoice, dueDate);
    await this.logInvoiceCreated(customer, invoice);
    await this.publishInvoiceCreated(customer, invoice, dueDate);
    return invoice;
  }

  private buildInvoicePayload(customer: BillingCustomerPayload, dueDate: Date) {
    const amount = BigInt(customer.hargaPaket.harga);
    const taxAmount = this.calculateTaxAmount(customer, amount);
    const totalAmount = amount + taxAmount;

    return {
      id: randomUUID(),
      invoiceNumber: this.createInvoiceNumber(),
      pelangganId: customer.id,
      issueDate: new Date(),
      dueDate,
      status: "SENT" as const,
      subtotal: amount,
      taxAmount,
      totalAmount,
      updatedAt: new Date(),
    };
  }

  private buildInvoiceItemPayload(customer: BillingCustomerPayload) {
    const amount = BigInt(customer.hargaPaket.harga);
    return {
      id: randomUUID(),
      description: `Berlangganan Internet Paket ${customer.hargaPaket.name}`,
      quantity: 1,
      unitPrice: amount,
      totalPrice: amount,
      itemType: "SERVICE" as const,
    };
  }

  private calculateTaxAmount(customer: BillingCustomerPayload, amount: bigint) {
    if (!customer.usePPN && !customer.hargaPaket.usePPN) return 0n;

    const ppnRate = customer.hargaPaket.ppnPercentage || 11;
    return (amount * BigInt(Math.round(ppnRate * 100))) / 10000n;
  }

  private createInvoiceNumber() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const currentDay = String(now.getDate()).padStart(2, "0");
    const uniqueSuffix = randomUUID()
      .replace(/-/g, "")
      .substring(0, 12)
      .toUpperCase();

    return `INV/${currentYear}/${currentMonth}/${currentDay}-${uniqueSuffix}`;
  }

  private async notifyInvoiceCreated(
    customer: BillingCustomerPayload,
    invoice: { id: string; totalAmount: bigint },
    dueDate: Date,
  ) {
    const message = `Tagihan bulan ini sebesar Rp ${Number(invoice.totalAmount).toLocaleString("id-ID")} telah terbit. Jatuh tempo pada ${dueDate.toLocaleDateString("id-ID")}.`;

    await notifyCustomerFinanceNotification({
      userId: customer.userId,
      title: "Tagihan Baru Tersedia",
      message,
      link: "/tagihan",
      sourceType: "INVOICE",
      sourceId: invoice.id,
      priority: "NORMAL",
    }).catch((error) => {
      logger.error(
        `[Billing] Failed to send notification for ${customer.nama}:`,
        error,
      );
    });

    await this.sendPushNotification(customer, invoice.id, message);
  }

  private async sendPushNotification(
    customer: BillingCustomerPayload,
    invoiceId: string,
    message: string,
  ) {
    try {
      const notifAppSetting =
        await this.settingsRepo.findByKey("GENERAL_NOTIF_APP");
      if (notifAppSetting?.value === "false") return;

      await sendCustomerPushNotification(
        customer.id,
        "Tagihan Baru Tersedia",
        message,
        {
          type: "INVOICE_GENERATED",
          invoiceId,
          url: "/(customer)/tagihan",
        },
      );
    } catch (error) {
      logger.error(
        `[Billing] Failed to send push notification for ${customer.nama}:`,
        error,
      );
    }
  }

  private async logInvoiceCreated(
    customer: BillingCustomerPayload,
    invoice: { id: string; invoiceNumber?: string },
  ) {
    await logger.logActivity({
      action: "CREATE",
      subject: "Invoice (Auto)",
      details: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customer: customer.nama,
        actor: "SYSTEM_CRON",
        nextDueDate: new Date(customer.jatuhTempo).toISOString(),
      },
    });
  }

  private async publishInvoiceCreated(
    customer: BillingCustomerPayload,
    invoice: { id: string; totalAmount: bigint },
    dueDate: Date,
  ) {
    const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
    await eventBus
      .publish(EVENT_NAMES.INVOICE_CREATED, {
        invoiceId: invoice.id,
        pelangganId: customer.id,
        amount: Number(invoice.totalAmount),
        dueDate: dueDate.toISOString(),
      })
      .catch((error) =>
        logger.error(
          "Failed to publish INVOICE_CREATED event",
          error instanceof Error ? error : undefined,
        ),
      );
  }
}
