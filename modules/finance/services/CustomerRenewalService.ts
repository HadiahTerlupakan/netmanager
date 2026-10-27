import { acquireLock } from "@/lib/distributed-lock";
import type { PelangganBillingBridgeService } from "@/modules/pelanggan";
import type { PaymentMethod } from "../lib/billing-prisma-boundary";
import { getPelangganBillingBridge } from "../pelanggan-registry";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { InvoiceStatus } from "../types/invoice.enums";
import { BillingInvoiceCreationService } from "./BillingInvoiceCreationService";
import { InvoicePaymentStateService } from "./InvoicePaymentStateService";
import { createPaymentForRoute } from "./PaymentRouteService";
import { calculateNextDueDate } from "./automatic-billing-payment.helpers";
import {
  createDueDateRange,
  mapRealtimeCustomerToBillingPayload,
  resolveInvoiceDueDate,
} from "./automatic-billing.helpers";

/** Status invoice yang masih menunggu pelunasan. */
const OUTSTANDING_STATUSES = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.PARTIAL_PAID,
];

const RENEWAL_LOCK_TTL_SECONDS = 30;

export type RenewalPaymentStatus = "LUNAS" | "BELUM_LUNAS";

export type RenewCustomerCycleInput = {
  pelangganId: string;
  statusBayar: RenewalPaymentStatus;
  paymentMethod: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  userId: string;
};

export type RenewCustomerCycleResult = {
  invoiceId: string;
  invoiceStatus: string;
  /** Jatuh tempo yang akan dipasang worker INVOICE_PAID; null bila belum lunas. */
  expectedJatuhTempo: Date | null;
};

type CycleInvoice = {
  id: string;
  status: string;
  dueDate: Date;
  totalAmount: bigint;
  paidAmount: bigint;
};

type RenewableCustomer = NonNullable<
  Awaited<ReturnType<PelangganBillingBridgeService["findByIdWithHargaPaket"]>>
>;

function getInvoiceRepository() {
  return new InvoiceRepository();
}

export class CustomerRenewalError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "NOT_RENEWABLE" | "BUSY",
  ) {
    super(message);
    this.name = "CustomerRenewalError";
  }
}

/**
 * Perpanjangan layanan dari admin di atas sistem invoice.
 *
 * Service ini hanya memastikan invoice siklus berjalan ada lalu (bila LUNAS)
 * melunasinya. Pergeseran jatuh tempo, aktivasi, dan notifikasi tetap milik
 * worker INVOICE_PAID supaya pembayaran dari jalur mana pun berperilaku sama.
 */
export class CustomerRenewalService {
  private readonly invoiceRepo = getInvoiceRepository();
  private readonly invoiceCreationService = new BillingInvoiceCreationService(
    this.invoiceRepo,
  );
  private readonly paymentStateService = new InvoicePaymentStateService(
    this.invoiceRepo,
  );

  /** Pastikan invoice siklus berjalan ada, lunasi bila diminta. */
  async renewCurrentCycle(
    input: RenewCustomerCycleInput,
  ): Promise<RenewCustomerCycleResult> {
    // Dua klik atau dua admin sekaligus sama-sama tidak melihat invoice
    // terbuka lalu menerbitkan dua, atau sama-sama membayar sisa yang sama.
    // Tanpa lock tidak ada yang dijalankan: pembayaran ganda lebih mahal
    // daripada meminta admin mencoba lagi.
    const release = await acquireLock(`renewal:${input.pelangganId}`, {
      ttlSeconds: RENEWAL_LOCK_TTL_SECONDS,
    });
    if (!release) {
      throw new CustomerRenewalError(
        "Perpanjangan pelanggan ini sedang diproses, coba lagi sebentar lagi",
        "BUSY",
      );
    }

    try {
      return await this.renewLocked(input);
    } finally {
      await release();
    }
  }

  private async renewLocked(
    input: RenewCustomerCycleInput,
  ): Promise<RenewCustomerCycleResult> {
    const customer = await this.loadRenewableCustomer(input.pelangganId);
    const invoice = await this.ensureCycleInvoice(customer);
    const finalInvoice =
      input.statusBayar === "LUNAS"
        ? await this.settleInvoice(invoice, input)
        : invoice;
    const isPaid = finalInvoice.status === InvoiceStatus.PAID;

    return {
      invoiceId: finalInvoice.id,
      invoiceStatus: finalInvoice.status,
      expectedJatuhTempo: isPaid
        ? calculateNextDueDate(customer, new Date(finalInvoice.dueDate))
        : null,
    };
  }

  private async loadRenewableCustomer(pelangganId: string) {
    const customer =
      await getPelangganBillingBridge().findByIdWithHargaPaket(pelangganId);
    if (!customer) {
      throw new CustomerRenewalError("Pelanggan tidak ditemukan", "NOT_FOUND");
    }
    if (!customer.hargaPaket) {
      throw new CustomerRenewalError(
        "Pelanggan belum memiliki paket",
        "NOT_RENEWABLE",
      );
    }
    if (customer.status === "DISMANTLE") {
      throw new CustomerRenewalError(
        "Pelanggan sudah dismantle dan tidak bisa diperpanjang",
        "NOT_RENEWABLE",
      );
    }

    return customer;
  }

  /**
   * Tagihan yang masih terbuka dipakai ulang lebih dulu, termasuk yang jatuh
   * temponya bukan tanggal siklus (mis. invoice registrasi bertanggal hari
   * itu): membuat invoice baru di sampingnya berarti menagih pelanggan dua kali.
   */
  private async ensureCycleInvoice(
    customer: RenewableCustomer,
  ): Promise<CycleInvoice> {
    const dueDate = resolveInvoiceDueDate(new Date(customer.jatuhTempo));
    const outstanding = await this.findOutstandingInvoices(customer.id);
    if (outstanding.length > 0) {
      return pickCycleInvoice(outstanding, dueDate);
    }

    const paidForCycle = await this.findPaidInvoiceForCycle(
      customer.id,
      dueDate,
    );
    if (paidForCycle) return paidForCycle;

    return this.invoiceCreationService.createInvoiceForCustomer(
      mapRealtimeCustomerToBillingPayload(customer),
      dueDate,
    ) as Promise<CycleInvoice>;
  }

  private async findOutstandingInvoices(pelangganId: string) {
    return (await this.invoiceRepo.findUnpaidInvoices(
      { pelangganId, status: { in: OUTSTANDING_STATUSES } },
      {
        id: true,
        status: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
      },
    )) as CycleInvoice[];
  }

  /**
   * Invoice siklus yang sudah lunas tetapi jatuh temponya belum digeser worker
   * (event masih di antrean). Tanpa pengecekan ini, klik ulang admin
   * menerbitkan tagihan kedua untuk siklus yang sama.
   */
  private async findPaidInvoiceForCycle(pelangganId: string, dueDate: Date) {
    const range = createDueDateRange(dueDate);
    const invoices = await this.invoiceRepo.findManyForExactDueDate(
      pelangganId,
      range.start,
      range.end,
    );
    const paid = invoices.find(
      (invoice) => invoice.status === InvoiceStatus.PAID,
    );
    return (paid as CycleInvoice | undefined) ?? null;
  }

  private async settleInvoice(
    invoice: CycleInvoice,
    input: RenewCustomerCycleInput,
  ): Promise<CycleInvoice> {
    if (invoice.status === InvoiceStatus.PAID) return invoice;

    const remaining =
      BigInt(invoice.totalAmount) - BigInt(invoice.paidAmount ?? 0n);
    if (remaining > 0n) {
      await this.payRemaining(invoice.id, remaining, input);
    } else {
      // Invoice Rp0 (paket gratis atau tertutup saldo kredit) tidak bisa
      // menerima payment karena amount minimal 1; recompute yang melunasinya.
      await this.paymentStateService.recompute(invoice.id);
    }

    const refreshed = await this.invoiceRepo.findRawById(invoice.id);
    return (refreshed as CycleInvoice | null) ?? invoice;
  }

  private async payRemaining(
    invoiceId: string,
    remaining: bigint,
    input: RenewCustomerCycleInput,
  ) {
    const result = await createPaymentForRoute({
      input: {
        invoiceId,
        pelangganId: input.pelangganId,
        amount: Number(remaining),
        paymentMethod: input.paymentMethod,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
      },
      user: { id: input.userId },
    });
    if (result.status !== "created") {
      throw new CustomerRenewalError(
        "Pembayaran tidak bisa dicatat untuk invoice ini",
        "NOT_FOUND",
      );
    }
  }
}

/** Utamakan invoice siklus berjalan; selain itu tunggakan paling lama. */
function pickCycleInvoice(
  invoices: CycleInvoice[],
  cycleDueDate: Date,
): CycleInvoice {
  const range = createDueDateRange(cycleDueDate);
  const sameCycle = invoices.find((invoice) => {
    const dueDate = new Date(invoice.dueDate);
    return dueDate >= range.start && dueDate <= range.end;
  });
  if (sameCycle) return sameCycle;

  return [...invoices].sort(
    (left, right) =>
      new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
  )[0];
}
