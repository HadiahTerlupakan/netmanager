import { prisma } from "@/lib/prisma";
import type {
  IWorkOrderServiceLevelRepository,
  ServiceLevelWorkOrderQuery,
  ServiceLevelWorkOrderRecord,
} from "../domain/ports/IWorkOrderServiceLevelRepository";

/** Work order dalam rentang waktu, tanpa yang dibatalkan, terurut waktu dibuat. */
export class WorkOrderServiceLevelRepository implements IWorkOrderServiceLevelRepository {
  async findForServiceLevel(
    query: ServiceLevelWorkOrderQuery,
  ): Promise<ServiceLevelWorkOrderRecord[]> {
    return prisma.workOrders.findMany({
      where: {
        tenantId: query.tenantId,
        type: { in: query.types },
        ...(query.siteIds ? { siteId: { in: query.siteIds } } : {}),
        status: { not: "CANCELLED" },
        createdAt: { gte: query.from, lt: query.to },
      },
      select: {
        id: true,
        workOrderNumber: true,
        type: true,
        status: true,
        siteId: true,
        createdAt: true,
        approvedAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }
}

/** Factory supaya service bergantung pada port, bukan kelas konkret. */
export function createWorkOrderServiceLevelRepository(): IWorkOrderServiceLevelRepository {
  return new WorkOrderServiceLevelRepository();
}
