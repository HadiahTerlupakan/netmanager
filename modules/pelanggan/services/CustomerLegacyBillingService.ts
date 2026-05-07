import { canAccessSite } from "@/modules/roles";
import { isSuperAdmin } from "@/lib/auth";
import { PelangganRepository } from "../repositories/PelangganRepository";
import { CustomerInvoiceRepository } from "../repositories/CustomerInvoiceRepository";

interface CustomerAccessRepository {
  findCustomerBillingAccess(input: {
    pelangganId: string;
    tenantId?: string | null;
  }): Promise<{ id: string; siteId: string | null } | null>;
}

interface LegacyInvoiceRepository {
  findLegacyTagihanByPelanggan(input: {
    pelangganId: string;
    tenantId?: string | null;
  }): Promise<LegacyInvoiceRecord[]>;
}

interface LegacyInvoiceRecord {
  id: string;
  invoiceNumber: string;
  subtotal: unknown;
  discountAmount: unknown;
  taxAmount: unknown;
  totalAmount: unknown;
  status: string;
  dueDate: Date;
  paidAt: Date | null;
  createdAt: Date;
  payment: Array<{ paymentMethod: string | null }>;
}

export class CustomerLegacyBillingService {
  constructor(
    private readonly pelangganRepository: CustomerAccessRepository = new PelangganRepository(),
    private readonly invoiceRepository: LegacyInvoiceRepository = new CustomerInvoiceRepository(),
  ) {}

  /** Mengambil tagihan pelanggan dalam kontrak legacy. */
  async getCustomerTagihan(input: {
    pelangganId: string;
    tenantId?: string | null;
    isSuperAdmin?: boolean;
    session?: Parameters<typeof canAccessSite>[0];
    isLatest: boolean;
  }) {
    await this.ensureCustomerAccess(input);
    const invoices = await this.invoiceRepository.findLegacyTagihanByPelanggan({
      pelangganId: input.pelangganId,
      tenantId: input.tenantId,
    });
    const tagihans = invoices.map((invoice) => this.mapLegacyTagihan(invoice));

    return input.isLatest
      ? { tagihan: tagihans[0] || null }
      : { data: tagihans };
  }

  private async ensureCustomerAccess(input: {
    pelangganId: string;
    tenantId?: string | null;
    isSuperAdmin?: boolean;
    session?: Parameters<typeof canAccessSite>[0];
  }) {
    if (!input.tenantId && !input.isSuperAdmin) {
      throw new CustomerLegacyBillingError(
        "Akses ditolak: tenant tidak teridentifikasi",
        403,
      );
    }

    const pelanggan = await this.pelangganRepository.findCustomerBillingAccess({
      pelangganId: input.pelangganId,
      tenantId: input.tenantId,
    });

    if (!pelanggan) {
      throw new CustomerLegacyBillingError("Pelanggan tidak ditemukan", 404);
    }

    if (input.session?.user && !isSuperAdmin(input.session.user)) {
      const hasAccess = canAccessSite(
        input.session,
        "pelanggan",
        pelanggan.siteId,
      );
      if (!hasAccess) {
        throw new CustomerLegacyBillingError("Akses ditolak", 403);
      }
    }
  }

  private mapLegacyTagihan(invoice: LegacyInvoiceRecord) {
    const date = new Date(invoice.createdAt);

    return {
      id: invoice.id,
      noTagihan: invoice.invoiceNumber,
      periodeBulan: date.getMonth() + 1,
      periodeTahun: date.getFullYear(),
      subtotal: Number(invoice.subtotal),
      diskon: Number(invoice.discountAmount),
      ppn: Number(invoice.taxAmount),
      biayaInstalasi: 0,
      biayaSewaPerangkat: 0,
      biayaLainnya: 0,
      total: Number(invoice.totalAmount),
      status: this.mapStatus(invoice.status),
      jatuhTempo: invoice.dueDate.toISOString(),
      tanggalBayar: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      metodePembayaran: invoice.payment[0]?.paymentMethod ?? null,
      createdAt: invoice.createdAt.toISOString(),
    };
  }

  private mapStatus(status: string) {
    if (status === "PAID") return "LUNAS";
    if (status === "OVERDUE") return "TERLAMBAT";
    if (status === "CANCELLED") return "LUNAS";
    return "BELUM_LUNAS";
  }
}

export class CustomerLegacyBillingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
