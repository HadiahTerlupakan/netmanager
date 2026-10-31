import type { InvoiceReplacementReason } from "@/lib/event-bus";
import { logger } from "@/lib/logger";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { getPelangganBillingBridge } from "../pelanggan-registry";
import {
  type CycleInvoice,
  findBillingPackage,
  findCycleInvoicesWithPayments,
} from "../repositories/CycleBillingRepository";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import type { BillingCustomerPayload } from "./automatic-billing.helpers";
import { mapRealtimeCustomerToBillingPayload } from "./automatic-billing.helpers";
import { BillingInvoiceCreationService } from "./BillingInvoiceCreationService";
import {
  findRepriceBlocker,
  type RepriceBlocker,
} from "./cycle-invoice-reprice";
import { runUnderCustomerCheckoutLockAsSystem } from "./customer-checkout-lock";
import { cancelReplacedInvoice } from "./outstanding-invoice.helpers";

/** Alasan tagihan siklus dibiarkan dengan nominal yang sudah terbit. */
export type CycleInvoiceKeptReason =
  | RepriceBlocker
  | "PRICE_EDITED"
  | "MULTIPLE_INVOICES";

/** Apa yang terjadi pada tagihan siklus setelah paket siklus itu berubah. */
export type CycleInvoiceSyncResult =
  | { status: "NOT_ISSUED" }
  | {
      status: "UNCHANGED";
      invoiceId: string;
      dueDate: Date;
      totalAmount: bigint;
    }
  | {
      status: "REPRICED";
      invoiceId: string;
      replacedInvoiceId: string;
      dueDate: Date;
      totalAmount: bigint;
    }
  | {
      status: "KEPT";
      reason: CycleInvoiceKeptReason;
      invoiceId: string;
      dueDate: Date;
      totalAmount: bigint;
    };

export interface SyncCycleInvoiceInput {
  pelangganId: string;
  /** Jatuh tempo siklus yang paketnya berubah. */
  cycleDate: Date;
  /** Paket yang menagih siklus itu sebelum perubahan. */
  previousPackageId: string;
  /** Disebut di notifikasi tagihan pengganti yang diterima pelanggan. */
  reason: InvoiceReplacementReason;
}

/** Dependensi yang bisa diganti di test. */
export interface CycleInvoiceRepriceDeps {
  findCycleInvoices: typeof findCycleInvoicesWithPayments;
  findBillingPackage: typeof findBillingPackage;
  loadCustomer: (pelangganId: string) => Promise<BillingCustomerPayload | null>;
  invoiceCreation: Pick<
    BillingInvoiceCreationService,
    "withCyclePackage" | "createInvoiceForCustomer"
  >;
  /** Membatalkan tagihan bila masih belum dibayar; false bila tidak lagi. */
  cancelInvoice: (invoice: {
    id: string;
    tenantId: string | null;
  }) => Promise<boolean>;
  /** Menjalankan `task` di bawah kunci checkout pelanggan, dalam konteks sistem. */
  runExclusively: <T>(
    pelangganId: string,
    task: () => Promise<T>,
  ) => Promise<T>;
  now: () => Date;
}

/**
 * Menyelaraskan tagihan siklus yang sudah terbit dengan paket yang berlaku
 * pada siklus itu, setelah perubahan paket terjadwal diajukan atau dibatalkan.
 *
 * Tagihan diganti (dibatalkan lalu diterbitkan ulang lewat jalur pembuatan
 * tagihan biasa), bukan diedit di tempat, supaya PPN, saldo kredit, durable
 * schedule, dan jurnal piutangnya dihitung sama persis dengan tagihan normal.
 * Tagihan yang sudah menerima pembayaran atau punya checkout gateway aktif
 * dibiarkan utuh; tidak ada penyesuaian setengah jalan.
 */
export class CycleInvoiceRepriceService {
  private readonly deps: CycleInvoiceRepriceDeps;

  constructor(deps: Partial<CycleInvoiceRepriceDeps> = {}) {
    this.deps = { ...createDefaultDeps(), ...deps };
  }

  /** Ganti tagihan siklus bila paket yang berlaku sudah berbeda. */
  async syncCycleInvoice(
    input: SyncCycleInvoiceInput,
  ): Promise<CycleInvoiceSyncResult> {
    return this.deps.runExclusively(input.pelangganId, () =>
      this.syncLocked(input),
    );
  }

  private async syncLocked(
    input: SyncCycleInvoiceInput,
  ): Promise<CycleInvoiceSyncResult> {
    const invoices = await this.deps.findCycleInvoices(
      input.pelangganId,
      toStartOfDay(input.cycleDate),
      toEndOfDay(input.cycleDate),
    );
    if (invoices.length === 0) return { status: "NOT_ISSUED" };

    const [invoice] = invoices;
    if (invoices.length > 1) {
      return this.keep(input, invoice, "MULTIPLE_INVOICES");
    }

    const customer = await this.loadCustomer(input.pelangganId, invoice);
    const cyclePackage = (
      await this.deps.invoiceCreation.withCyclePackage(
        customer,
        invoice.dueDate,
      )
    ).hargaPaket;
    // Sudah dihitung dari paket yang berlaku (mis. jadwal yang dibatalkan
    // tidak pernah sempat mengubah tagihannya): tidak ada yang dipulihkan.
    const isAlreadyCurrent =
      cyclePackage.id === input.previousPackageId ||
      BigInt(invoice.subtotal) === BigInt(cyclePackage.harga);
    if (isAlreadyCurrent) {
      return {
        status: "UNCHANGED",
        invoiceId: invoice.id,
        dueDate: invoice.dueDate,
        totalAmount: BigInt(invoice.totalAmount),
      };
    }

    const keptReason =
      findRepriceBlocker(invoice, this.deps.now()) ??
      (await this.findPriceEdit(invoice, input.previousPackageId));
    if (keptReason) return this.keep(input, invoice, keptReason);

    return this.replace(input, invoice, customer);
  }

  private async loadCustomer(pelangganId: string, invoice: CycleInvoice) {
    const customer = await this.deps.loadCustomer(pelangganId);
    if (!customer) {
      throw new Error(
        `[CycleInvoiceReprice] Pelanggan ${pelangganId} tanpa paket; tagihan ${invoice.id} tidak bisa dihitung ulang`,
      );
    }
    return customer;
  }

  /** Subtotal tagihan sistem = harga paket; selisih berarti diubah tangan. */
  private async findPriceEdit(
    invoice: CycleInvoice,
    previousPackageId: string,
  ): Promise<CycleInvoiceKeptReason | null> {
    const previous = await this.deps.findBillingPackage(previousPackageId);
    if (previous && BigInt(invoice.subtotal) === BigInt(previous.harga)) {
      return null;
    }
    return "PRICE_EDITED";
  }

  private keep(
    input: SyncCycleInvoiceInput,
    invoice: CycleInvoice,
    reason: CycleInvoiceKeptReason,
  ): CycleInvoiceSyncResult {
    logger.warn(
      `[CycleInvoiceReprice] Tagihan ${invoice.id} pelanggan ${input.pelangganId} (jatuh tempo ${invoice.dueDate.toISOString()}) TIDAK dihitung ulang setelah paket siklusnya berubah: ${reason}. Nominal ${invoice.totalAmount} tetap berlaku.`,
    );
    return {
      status: "KEPT",
      reason,
      invoiceId: invoice.id,
      dueDate: invoice.dueDate,
      totalAmount: BigInt(invoice.totalAmount),
    };
  }

  private async replace(
    input: SyncCycleInvoiceInput,
    invoice: CycleInvoice,
    customer: BillingCustomerPayload,
  ): Promise<CycleInvoiceSyncResult> {
    // Saldo kredit yang dipakai tagihan lama dikembalikan oleh pembatalannya,
    // sehingga tagihan pengganti memakainya lagi sesuai nominal barunya.
    const cancelled = await this.deps.cancelInvoice({
      id: invoice.id,
      tenantId: invoice.tenantId,
    });
    // Dilunasi tepat di antara pemeriksaan dan pembatalan (webhook tidak
    // memegang kunci checkout): tagihannya tetap, tanpa pengganti.
    if (!cancelled) return this.keep(input, invoice, "NOT_UNPAID");

    const replacement = await this.createReplacement(
      invoice,
      customer,
      input.reason,
    );
    logger.info(
      `[CycleInvoiceReprice] Tagihan ${invoice.id} (${invoice.totalAmount}) pelanggan ${customer.id} diganti ${replacement.id} (${replacement.totalAmount}) mengikuti paket siklusnya`,
    );
    return {
      status: "REPRICED",
      invoiceId: replacement.id,
      replacedInvoiceId: invoice.id,
      dueDate: replacement.dueDate,
      totalAmount: BigInt(replacement.totalAmount),
    };
  }

  private async createReplacement(
    invoice: CycleInvoice,
    customer: BillingCustomerPayload,
    reason: InvoiceReplacementReason,
  ) {
    try {
      return await this.deps.invoiceCreation.createInvoiceForCustomer(
        customer,
        invoice.dueDate,
        {
          replacesInvoiceNumber: invoice.invoiceNumber,
          replacementReason: reason,
        },
      );
    } catch (error) {
      // Billing harian menganggap siklus yang punya invoice batal sudah
      // ditagih, jadi siklus ini tidak akan diterbitkan ulang otomatis.
      logger.error(
        `[CycleInvoiceReprice] Tagihan ${invoice.id} sudah dibatalkan tetapi penggantinya gagal dibuat; terbitkan ulang tagihan pelanggan ${customer.id} secara manual`,
        error instanceof Error ? error : undefined,
      );
      throw error;
    }
  }
}

function createDefaultDeps(): CycleInvoiceRepriceDeps {
  const invoiceRepo = new InvoiceRepository();
  return {
    findCycleInvoices: findCycleInvoicesWithPayments,
    findBillingPackage,
    loadCustomer: loadBillingCustomer,
    invoiceCreation: new BillingInvoiceCreationService(invoiceRepo),
    cancelInvoice: (invoice) => cancelReplacedInvoice({ invoiceRepo, invoice }),
    runExclusively: (pelangganId, task) =>
      runUnderCustomerCheckoutLockAsSystem(
        pelangganId,
        "cycle-invoice-reprice",
        task,
      ),
    now: () => new Date(),
  };
}

async function loadBillingCustomer(
  pelangganId: string,
): Promise<BillingCustomerPayload | null> {
  const customer =
    await getPelangganBillingBridge().findByIdWithHargaPaket(pelangganId);
  if (!customer?.hargaPaket) return null;
  return mapRealtimeCustomerToBillingPayload(customer);
}
