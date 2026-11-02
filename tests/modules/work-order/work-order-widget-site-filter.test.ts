import { describe, expect, it, vi } from "vitest";

import { getAdminResponseStats } from "@/modules/work-order/repositories/work-order-repository-analytics-admin";
import {
  getDepartmentWorkload,
  getRecentWorkOrders,
} from "@/modules/work-order/repositories/work-order-repository-dashboard";
import { buildCompletedWorkOrderWhere } from "@/modules/work-order/repositories/work-order-repository-performance-helpers";

/**
 * Widget dashboard/analitik Work Order dulu hanya menerima `departmentId`,
 * sehingga role ber-`site_only` melihat data (termasuk nama & telepon
 * pelanggan di "WO terbaru") dari site lain. Filter site harus sampai ke
 * klausa `where` database.
 */

function fakePrisma() {
  return {
    workOrders: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(1),
    },
    departments: {
      findMany: vi.fn().mockResolvedValue([{ id: "dept-1", name: "Teknis" }]),
    },
    workOrderUpdates: { findMany: vi.fn().mockResolvedValue([]) },
    canvasing: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

describe("filter site pada widget work order", () => {
  it("WO terbaru menyaring siteId", async () => {
    const prisma = fakePrisma();

    await getRecentWorkOrders(prisma as never, 5, { siteId: "site-1" });

    expect(prisma.workOrders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { siteId: "site-1" } }),
    );
  });

  it("beban departemen menghitung hanya WO site sendiri", async () => {
    const prisma = fakePrisma();

    await getDepartmentWorkload(prisma as never, undefined, [
      "site-1",
      "site-2",
    ]);

    for (const [args] of prisma.workOrders.count.mock.calls) {
      expect(args.where).toMatchObject({
        departmentId: "dept-1",
        siteId: { in: ["site-1", "site-2"] },
      });
    }
  });

  it("top performer/assist menyaring seluruh site lingkup", () => {
    expect(
      buildCompletedWorkOrderWhere({ siteIds: ["site-1", "site-2"] }),
    ).toMatchObject({
      siteId: { in: ["site-1", "site-2"] },
    });
  });

  it("WO terbaru memakai seluruh site lingkup", async () => {
    const prisma = fakePrisma();

    await getRecentWorkOrders(prisma as never, 5, {
      siteIds: ["site-1", "site-2"],
    });

    expect(prisma.workOrders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { siteId: { in: ["site-1", "site-2"] } },
      }),
    );
  });

  it("statistik respons admin menyaring update dan canvasing di database", async () => {
    const prisma = fakePrisma();

    await getAdminResponseStats(prisma as never, new Date(0), new Date(), {
      siteIds: ["site-1"],
    });

    expect(prisma.workOrderUpdates.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workOrders: { siteId: { in: ["site-1"] } },
        }),
      }),
    );
    expect(prisma.canvasing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workOrder: { siteId: { in: ["site-1"] } },
        }),
      }),
    );
  });

  it("statistik respons admin tanpa pembatasan tidak menambah filter", async () => {
    const prisma = fakePrisma();

    await getAdminResponseStats(prisma as never, new Date(0), new Date());

    const [args] = prisma.workOrderUpdates.findMany.mock.calls[0];
    expect(args.where).not.toHaveProperty("workOrders");
  });
});
