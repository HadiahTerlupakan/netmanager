import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import { InvoiceRepository } from "../repositories/InvoiceRepository";

const DEFAULT_PPN_PERCENTAGE = 11;

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
  constructor(private readonly invoiceRepo = new InvoiceRepository()) {}

  /** Create invoice and send customer notifications. */
  async createInvoiceForCustomer(
    customer: BillingCustomerPayload,
    dueDate: Date,
  ) {
    const subtotal = BigInt(customer.hargaPaket.harga);
    const taxAmount = this.calculateTaxAmount(customer, subtotal);
    const grossTotal = subtotal + taxAmount;

    // Konsumsi saldo kredit (mis. dari downgrade prorate sebelumnya).
    // Decrement atomic via updateMany — kalau race, balik 0 dan tidak apply.
    const creditApplied = await this.consumeSaldoKredit(
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
      // supaya pelanggan tidak kehilangan kredit.
      if (creditApplied > 0n) {
        await prisma.pelanggan
          .update({
            where: { id: customer.id },
            data: { saldoKreditRupiah: { increment: creditApplied } },
          })
          .catch((compensationErr) =>
            logger.error(
              `[BillingInvoiceCreation] Gagal kompensasi saldo kredit ${creditApplied} untuk ${customer.id}`,
              compensationErr instanceof Error ? compensationErr : undefined,
            ),
          );
      }
      throw err;
    }
  }

  /**
   * Decrement saldoKreditRupiah pelanggan sebesar min(saldo, capAmount).
   * Atomic via updateMany dengan WHERE saldoKreditRupiah >= apply — kalau ada
   * mutasi konkuren yang membuat saldo turun di bawah `apply`, count akan 0
   * dan kita tidak apply discount apapun untuk siklus ini.
   */
  private async consumeSaldoKredit(
    pelangganId: string,
    capAmount: bigint,
  ): Promise<bigint> {
    if (capAmount <= 0n) return 0n;

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: { saldoKreditRupiah: true },
    });
    const saldo = pelanggan?.saldoKreditRupiah ?? 0n;
    if (saldo <= 0n) return 0n;

    const apply = saldo > capAmount ? capAmount : saldo;

    const result = await prisma.pelanggan.updateMany({
      where: { id: pelangganId, saldoKreditRupiah: { gte: apply } },
      data: { saldoKreditRupiah: { decrement: apply } },
    });

    if (result.count === 0) {
      logger.warn(
        `[BillingInvoiceCreation] Saldo kredit pelanggan ${pelangganId} berubah konkuren — skip apply discount`,
      );
      return 0n;
    }

    logger.info(
      `[BillingInvoiceCreation] Konsumsi saldo kredit ${apply} untuk pelanggan ${pelangganId}`,
    );
    return apply;
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

  private calculateTaxAmount(customer: BillingCustomerPayload, amount: bigint) {
    if (!customer.usePPN && !customer.hargaPaket.usePPN) return 0n;

    const ppnRate = customer.hargaPaket.ppnPercentage || DEFAULT_PPN_PERCENTAGE;
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
