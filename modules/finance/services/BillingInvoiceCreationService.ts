import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { getPpnRateResolver } from "@/modules/tax";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { FinanceRepositoryFacade } from "./FinanceRepositoryFacade";

type BillingCustomerPayload = {
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
};

export class BillingInvoiceCreationService {
  constructor(private readonly invoiceRepo = new InvoiceRepository()) {}

  /** Create invoice and send customer notifications. */
  async createInvoiceForCustomer(
    customer: BillingCustomerPayload,
    dueDate: Date,
  ) {
    const subtotal = BigInt(customer.hargaPaket.harga);
    const taxAmount = await this.calculateTaxAmount(customer, subtotal);
    const grossTotal = subtotal + taxAmount;

    // Konsumsi saldo kredit (mis. dari downgrade prorate sebelumnya).
    // Atomic via FinanceRepositoryFacade (SELECT FOR UPDATE di dalam).
    const creditApplied = await FinanceRepositoryFacade.consumeSaldoKredit(
      customer.id,
      grossTotal,
    );

    try {
      const invoice = await this.invoiceRepo.create({
        ...this.buildInvoicePayload({
          customer,
          dueDate,
          subtotal,
          taxAmount,
          creditApplied,
          totalAmount: grossTotal - creditApplied,
        }),
        invoiceItem: {
          create: [this.buildInvoiceItemPayload(customer)],
        },
      });

      await this.logInvoiceCreated(customer, invoice, creditApplied);
      await this.publishInvoiceCreated(customer, invoice, dueDate);
      const { syncInvoiceBillingSchedules } =
        await import("./billingScheduleLifecycle");
      await syncInvoiceBillingSchedules(invoice);
      return invoice;
    } catch (err) {
      // Compensating action — kembalikan saldo bila invoice gagal dibuat
      if (creditApplied > 0n) {
        await FinanceRepositoryFacade.refundSaldoKredit(
          customer.id,
          creditApplied,
        );
      }
      throw err;
    }
  }

  private buildInvoicePayload(params: {
    customer: BillingCustomerPayload;
    dueDate: Date;
    subtotal: bigint;
    taxAmount: bigint;
    creditApplied: bigint;
    totalAmount: bigint;
  }) {
    const note =
      params.creditApplied > 0n
        ? `Saldo kredit terpakai: Rp ${params.creditApplied.toString()}`
        : null;

    return {
      id: randomUUID(),
      invoiceNumber: this.createInvoiceNumber(),
      pelangganId: params.customer.id,
      issueDate: new Date(),
      dueDate: params.dueDate,
      status: "SENT" as const,
      subtotal: params.subtotal,
      taxAmount: params.taxAmount,
      discountAmount: params.creditApplied,
      totalAmount: params.totalAmount,
      notes: note,
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

  private async calculateTaxAmount(
    customer: BillingCustomerPayload,
    amount: bigint,
  ) {
    if (!customer.usePPN && !customer.hargaPaket.usePPN) return 0n;

    const ppnRate = await getPpnRateResolver().resolveOptional(
      customer.tenantId,
      customer.hargaPaket.ppnPercentage,
    );

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

  private async logInvoiceCreated(
    customer: BillingCustomerPayload,
    invoice: { id: string; invoiceNumber?: string },
    creditApplied: bigint,
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
        creditApplied: creditApplied.toString(),
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
