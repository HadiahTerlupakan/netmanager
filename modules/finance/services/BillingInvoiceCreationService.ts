import { randomUUID } from "crypto";
import type { InvoiceReplacement } from "@/lib/event-bus";
import { logger } from "@/lib/logger";
import { toEndOfDay } from "@/lib/utils/server-datetime";
import { getPpnRateResolver } from "@/modules/tax";
import {
  type BillingPackage,
  findPendingPackageAppliedBy,
} from "../repositories/CycleBillingRepository";
import type { InvoiceEntity } from "../domain/entities/InvoiceEntity";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { FinanceRepositoryFacade } from "./FinanceRepositoryFacade";
import { InvoicePaymentStateService } from "./InvoicePaymentStateService";
import { formatSaldoKreditNote } from "./saldo-kredit-note";

type BillingCustomerPayload = {
  id: string;
  nama: string;
  jatuhTempo: Date;
  userId: string | null;
  usePPN: boolean;
  tenantId: string | null;
  hargaPaket: BillingPackage;
};

type PendingPackageLookup = (
  pelangganId: string,
  appliesBy: Date,
) => Promise<BillingPackage | null>;

export class BillingInvoiceCreationService {
  constructor(
    private readonly invoiceRepo = new InvoiceRepository(),
    private readonly findPendingPackage: PendingPackageLookup = findPendingPackageAppliedBy,
  ) {}

  /**
   * Create invoice and send customer notifications. `replacement` diisi bila
   * tagihan ini menggantikan tagihan siklus yang baru dibatalkan, supaya
   * notifikasinya menyebut penggantian, bukan tagihan baru.
   *
   * Tagihan yang totalnya Rp0 (tertutup saldo kredit, atau paket gratis)
   * langsung dilunasi: ia tidak bisa menerima payment, jadi dulu tertahan
   * SENT lalu menjadi OVERDUE dan memicu isolir pelanggan yang tidak berutang.
   */
  async createInvoiceForCustomer(
    billedCustomer: BillingCustomerPayload,
    dueDate: Date,
    replacement?: InvoiceReplacement,
  ) {
    const customer = await this.withCyclePackage(billedCustomer, dueDate);
    const subtotal = BigInt(customer.hargaPaket.harga);
    const taxAmount = await this.calculateTaxAmount(customer, subtotal);
    const grossTotal = subtotal + taxAmount;

    // Konsumsi saldo kredit (mis. dari downgrade prorate sebelumnya).
    // Atomic via FinanceRepositoryFacade (SELECT FOR UPDATE di dalam).
    const creditApplied = await FinanceRepositoryFacade.consumeSaldoKredit(
      customer.id,
      grossTotal,
    );
    const invoice = await this.createRefundingSaldoOnFailure(customer, {
      dueDate,
      subtotal,
      taxAmount,
      creditApplied,
      totalAmount: grossTotal - creditApplied,
    });

    await this.logInvoiceCreated(customer, invoice, creditApplied);
    await this.publishInvoiceCreated(customer, invoice, dueDate, replacement, {
      creditApplied,
      grossTotal,
    });
    if (BigInt(invoice.totalAmount) === 0n) {
      return this.settleWithoutPayment(invoice);
    }
    const { syncInvoiceBillingSchedules } =
      await import("./billingScheduleLifecycle");
    await syncInvoiceBillingSchedules(invoice);
    return invoice;
  }

  /**
   * Saldo dikembalikan hanya bila tagihannya gagal dibuat. Setelah tagihan
   * tersimpan saldonya sudah terpakai olehnya; mengembalikannya karena
   * langkah sesudahnya gagal membuat pelanggan menerima potongan dan saldo.
   */
  private async createRefundingSaldoOnFailure(
    customer: BillingCustomerPayload,
    amounts: {
      dueDate: Date;
      subtotal: bigint;
      taxAmount: bigint;
      creditApplied: bigint;
      totalAmount: bigint;
    },
  ) {
    try {
      return await this.invoiceRepo.create({
        ...this.buildInvoicePayload({ customer, ...amounts }),
        invoiceItem: {
          create: [this.buildInvoiceItemPayload(customer)],
        },
      });
    } catch (err) {
      if (amounts.creditApplied > 0n) {
        await FinanceRepositoryFacade.refundSaldoKredit(
          customer.id,
          amounts.creditApplied,
        );
      }
      throw err;
    }
  }

  /**
   * Lunasi tagihan Rp0 lewat jalur pelunasan biasa: status PAID, jadwal
   * overdue/isolir dibatalkan, dan INVOICE_PAID terkirim sekali (perpanjangan
   * jatuh tempo, aktivasi, notifikasi "dibayar dengan saldo").
   */
  private async settleWithoutPayment(invoice: InvoiceEntity) {
    const result = await new InvoicePaymentStateService(
      this.invoiceRepo,
    ).recompute(invoice.id);
    return result?.invoice ?? invoice;
  }

  /**
   * Paket yang menagih siklus ber-jatuh-tempo `dueDate`.
   *
   * Tagihan siklus terbit beberapa hari sebelum jatuh tempo, sedangkan paket
   * terjadwal (NEXT_CYCLE) baru diganti cron pada jatuh tempo itu. Siklus yang
   * dimulai pada atau setelah tanggal berlakunya sudah milik paket baru, jadi
   * ditagih dengan paket itu, bukan paket yang kebetulan masih terpasang.
   */
  async withCyclePackage<T extends { id: string; hargaPaket: BillingPackage }>(
    customer: T,
    dueDate: Date,
  ): Promise<T> {
    const pendingPackage = await this.findPendingPackage(
      customer.id,
      toEndOfDay(dueDate),
    );
    if (!pendingPackage) return customer;

    logger.info(
      `[Billing] Tagihan jatuh tempo ${dueDate.toISOString()} pelanggan ${customer.id} memakai paket terjadwal ${pendingPackage.id}, bukan paket sekarang ${customer.hargaPaket.id}`,
    );
    return { ...customer, hargaPaket: pendingPackage };
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
        ? formatSaldoKreditNote(params.creditApplied)
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
      // Billing harian berjalan di konteks sistem, yang tidak menyuntikkan
      // tenantId; tanpa ini tagihannya tak terlihat oleh query ber-tenant.
      tenantId: params.customer.tenantId,
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
      tenantId: customer.tenantId,
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
    replacement: InvoiceReplacement | undefined,
    saldo: { creditApplied: bigint; grossTotal: bigint },
  ) {
    const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
    await eventBus
      .publish(EVENT_NAMES.INVOICE_CREATED, {
        invoiceId: invoice.id,
        pelangganId: customer.id,
        amount: Number(invoice.totalAmount),
        dueDate: dueDate.toISOString(),
        // Pelanggan perlu tahu saldo yang terpakai dan sisa yang dibayar.
        ...(saldo.creditApplied > 0n
          ? {
              creditApplied: Number(saldo.creditApplied),
              grossAmount: Number(saldo.grossTotal),
            }
          : {}),
        ...replacement,
      })
      .catch((error) =>
        logger.error(
          "Failed to publish INVOICE_CREATED event",
          error instanceof Error ? error : undefined,
        ),
      );
  }
}
