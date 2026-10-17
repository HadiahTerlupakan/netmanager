import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logActivitySafe: vi.fn(),
  purchaseRequestFindFirst: vi.fn(),
  purchaseOrderFindUnique: vi.fn(),
  purchaseOrderUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: mocks.logActivitySafe,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    apiRequest: vi.fn(),
    logActivity: vi.fn(),
  },
}));
vi.mock("@/modules/database", () => ({
  prisma: {
    purchaseRequest: { findFirst: mocks.purchaseRequestFindFirst },
    purchaseOrder: {
      findUnique: mocks.purchaseOrderFindUnique,
      update: mocks.purchaseOrderUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

import { createRestockRequest } from "@/modules/inventory/services/RestockRequestService";
import { InventoryRouteService } from "@/modules/inventory/services/InventoryRouteService";
import { RestockPurchaseOrderStatusService } from "@/modules/inventory/services/RestockPurchaseOrderStatusService";

function lastActivity() {
  expect(mocks.logActivitySafe).toHaveBeenCalledTimes(1);
  return mocks.logActivitySafe.mock.calls[0][0];
}

describe("Log Aktivitas pengajuan restock", () => {
  beforeEach(() => Object.values(mocks).forEach((fn) => fn.mockReset()));

  it("mencatat pembuatan pengajuan bernomor PR", async () => {
    mocks.purchaseRequestFindFirst.mockResolvedValue(null);
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        purchaseRequest: {
          create: vi.fn().mockResolvedValue({ id: "pr-1" }),
          findUnique: vi.fn().mockResolvedValue({ id: "pr-1" }),
        },
        purchaseRequestItem: { createMany: vi.fn() },
        purchaseRequestJasaItem: { createMany: vi.fn() },
      }),
    );

    const response = await createRestockRequest({
      items: [{ barangId: "b-1", quantity: 10 }],
      jasaItems: [{ jasaId: "j-1", jumlah: 1 }],
      gudangId: "g-1",
      keterangan: "stok menipis",
      requesterId: "user-1",
      tenantId: "tenant-1",
      apiPath: "/api/inventory/restock/requests",
    });

    expect(response.status).toBe(201);
    const activity = lastActivity();
    expect(activity).toMatchObject({
      action: "CREATE",
      userId: "user-1",
      tenantId: "tenant-1",
      details: {
        purchaseRequestId: "pr-1",
        gudangId: "g-1",
        jumlahBarang: 1,
        jumlahJasa: 1,
        keterangan: "stok menipis",
      },
    });
    expect(activity.subject).toMatch(/^Pengajuan Restock PR-\d{8}-0001$/);
  });

  it("mencatat perubahan pengajuan", async () => {
    const repository = {
      updatePurchaseRequest: vi
        .fn()
        .mockResolvedValue({ id: "pr-1", nomorRequest: "PR-20261017-0001" }),
    };
    const service = new InventoryRouteService(repository as never);

    await service.updatePurchaseRequest({
      id: "pr-1",
      tenantId: "tenant-1",
      gudangId: "g-1",
      items: [{ barangId: "b-1", quantity: 5 }],
      actorId: "user-1",
    });

    expect(lastActivity()).toMatchObject({
      action: "UPDATE",
      subject: "Pengajuan Restock PR-20261017-0001",
      userId: "user-1",
      tenantId: "tenant-1",
      details: { purchaseRequestId: "pr-1", jumlahBarang: 1, jumlahJasa: 0 },
    });
  });

  it("mencatat penghapusan pengajuan", async () => {
    const repository = { deletePurchaseRequest: vi.fn() };
    const service = new InventoryRouteService(repository as never);

    await service.deletePurchaseRequest({
      id: "pr-1",
      nomorRequest: "PR-20261017-0001",
      purchaseOrderId: "po-1",
      actorId: "user-1",
      tenantId: "tenant-1",
    });

    expect(repository.deletePurchaseRequest).toHaveBeenCalledWith("pr-1");
    expect(lastActivity()).toMatchObject({
      action: "DELETE",
      subject: "Pengajuan Restock PR-20261017-0001",
      tenantId: "tenant-1",
      details: { purchaseRequestId: "pr-1", purchaseOrderId: "po-1" },
    });
  });

  it("mencatat persetujuan lewat route approve", async () => {
    const repository = {
      approvePurchaseRequest: vi.fn().mockResolvedValue({
        id: "pr-1",
        nomorRequest: "PR-20261017-0001",
        tenantId: "tenant-1",
      }),
    };
    const service = new InventoryRouteService(repository as never);

    await service.approvePurchaseRequest({ id: "pr-1", approverId: "user-1" });

    expect(lastActivity()).toMatchObject({
      action: "APPROVE",
      subject: "Pengajuan Restock PR-20261017-0001",
      userId: "user-1",
      tenantId: "tenant-1",
      details: { purchaseRequestId: "pr-1" },
    });
  });

  it("mencatat mulai belanja pada purchase order", async () => {
    mocks.purchaseOrderFindUnique.mockResolvedValue({
      id: "po-1",
      poNumber: "PO-20261017-0001",
      status: "DRAFT",
      tenantId: "tenant-1",
      items: [],
    });
    mocks.purchaseOrderUpdate.mockResolvedValue({ id: "po-1" });

    await new RestockPurchaseOrderStatusService().patchRestockRequestStatus({
      purchaseOrderId: "po-1",
      action: "START_SHOPPING",
      actorId: "user-1",
    });

    expect(lastActivity()).toMatchObject({
      action: "START_SHOPPING",
      subject: "Purchase Order PO-20261017-0001",
      userId: "user-1",
      tenantId: "tenant-1",
      details: {
        purchaseOrderId: "po-1",
        statusLama: "DRAFT",
        statusBaru: "ORDERED",
      },
    });
  });
});
