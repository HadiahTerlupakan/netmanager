import { PelangganRepository } from "../repositories/PelangganRepository";
import { prismaBilling } from "@/modules/database";

export class AdminCustomerInvoiceRouteService {
  constructor(
    private readonly pelangganRepository = new PelangganRepository(),
  ) {}

  /** Get customer invoices scoped by tenant for admin route. */
  async getCustomerInvoices(input: {
    pelangganId: string;
    tenantId?: string | null;
    isSuperAdmin?: boolean;
  }) {
    const customer = await this.pelangganRepository.findCustomerBillingAccess({
      pelangganId: input.pelangganId,
      tenantId: input.tenantId,
    });
    if (!customer && !input.isSuperAdmin) return null;
    const invoices = await prismaBilling.invoice.findMany({
      where: {
        pelangganId: input.pelangganId,
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        payment: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
    return invoices;
  }
}
