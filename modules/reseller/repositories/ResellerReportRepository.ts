import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IResellerReportRepository,
  ReportCommissionTotal,
  ReportCustomer,
  ReportOutlet,
  ReportReseller,
} from "../domain/ports/IResellerReportSources";

const ACTIVE_CUSTOMER_STATUS = "AKTIF";

export class ResellerReportRepository implements IResellerReportRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Reseller (belum dihapus) di tenant. */
  async findReseller(
    tenantId: string,
    resellerId: string,
  ): Promise<ReportReseller | null> {
    return this.db.reseller.findFirst({
      where: { id: resellerId, tenantId, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
  }

  /** Semua outlet reseller, termasuk yang dihapus, untuk label baris. */
  async findOutlets(
    tenantId: string,
    resellerId: string,
  ): Promise<readonly ReportOutlet[]> {
    return this.db.resellerOutlet.findMany({
      where: { resellerId, tenantId },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    });
  }

  /** Pelanggan yang saat ini dikaitkan ke reseller. */
  async findCustomers(
    tenantId: string,
    resellerId: string,
  ): Promise<readonly ReportCustomer[]> {
    const rows = await this.db.pelanggan.findMany({
      where: { tenantId, resellerId },
      select: { id: true, resellerOutletId: true, status: true },
    });
    return rows.map((row) => ({
      id: row.id,
      outletId: row.resellerOutletId,
      isActive: row.status === ACTIVE_CUSTOMER_STATUS,
    }));
  }

  /** Komisi terbit di periode, per pelanggan dan status. */
  async sumCommissions(
    tenantId: string,
    resellerId: string,
    period: string,
  ): Promise<readonly ReportCommissionTotal[]> {
    const rows = await this.db.resellerCommission.groupBy({
      by: ["pelangganId", "status"],
      where: { tenantId, resellerId, period, deletedAt: null },
      _sum: { commissionAmount: true },
    });
    return rows.map((row) => ({
      pelangganId: row.pelangganId,
      status: row.status,
      amount: row._sum.commissionAmount ?? 0,
    }));
  }
}
