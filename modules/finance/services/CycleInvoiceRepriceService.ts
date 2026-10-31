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
import { FinanceRepositoryFacade } from "./FinanceRepositoryFacade";
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
  cancelInvoice: (invoice: {
    id: string;
    tenantId: string | null;
  }) => Promise<void>;
  refundSaldoKredit: (pelangganId: string, amount: bigint) => Promise<void>;
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

    return this.replace(invoice, customer, input.reason);
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
    invoice: CycleInvoice,
    customer: BillingCustomerPayload,
    reason: InvoiceReplacementReason,
  ): Promise<CycleInvoiceSyncResult> {
    await this.deps.cancelInvoice({
      id: invoice.id,
      tenantId: invoice.tenantId,
    });
    // Potongan tagihan sistem hanya berasal dari saldo kredit. Dikembalikan
    // dulu supaya tagihan pengganti memakainya lagi sesuai nominal barunya.
    const creditUsed = BigInt(invoice.discountAmount);
    if (creditUsed > 0n) {
      await this.deps.refundSaldoKredit(customer.id, creditUsed);
    }

    const replacement = await this.createReplacement(invoice, customer, reason);
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
    refundSaldoKredit: (pelangganId, amount) =>
      FinanceRepositoryFacade.refundSaldoKredit(pelangganId, amount),
    runExclusively: runUnderCheckoutLockAsSystem,
    now: () => new Date(),
  };
}

/**
 * Kunci yang sama dengan pembuatan checkout portal: tanpa itu pelanggan bisa
 * membuat VA untuk tagihan lama tepat saat tagihan itu dibatalkan.
 *
 * Konteks sistem karena tagihan dari billing harian (cron, konteks sistem)
 * tersimpan tanpa tenantId dan tidak terlihat oleh query ber-tenant. Pemanggil
 * sudah memastikan pelanggannya milik tenant yang meminta.
 */
async function runUnderCheckoutLockAsSystem<T>(
  pelangganId: string,
  task: () => Promise<T>,
): Promise<T> {
  const [{ withCustomerCheckoutLock }, { runAsSystemContext }] =
    await Promise.all([
      import("@/modules/payment-gateway"),
      import("@/lib/tenant-context"),
    ]);
  return withCustomerCheckoutLock(pelangganId, () =>
    runAsSystemContext("cycle-invoice-reprice", task),
  );
}

async function loadBillingCustomer(
  pelangganId: string,
): Promise<BillingCustomerPayload | null> {
  const customer =
    await getPelangganBillingBridge().findByIdWithHargaPaket(pelangganId);
  if (!customer?.hargaPaket) return null;
  return mapRealtimeCustomerToBillingPayload(customer);
}
