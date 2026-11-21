import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logActivitySafe }));

import type { RestockRequestForDeletion } from "@/modules/inventory/domain/ports/IRestockRequestDeletionRepository";
import {
  RestockRequestDeletionService,
  type RestockOrderRemovalOutcome,
} from "@/modules/inventory/services/RestockRequestDeletionService";
import { RESTOCK_MESSAGES } from "@/modules/inventory/services/restock-messages";
import { RESTOCK_REQUEST_BUSY_MESSAGE } from "@/modules/inventory/services/restock-request-lock";

const command = { id: "pr-1", tenantId: "tenant-1", actorId: "user-1" };

/** Pengajuan disetujui dengan pesanan DRAFT yang belum menerima apa pun. */
function approvedRequest(
  overrides: Partial<RestockRequestForDeletion> = {},
): RestockRequestForDeletion {
  return {
    id: "pr-1",
    nomorRequest: "PR-20261121-0001",
    status: "ORDERED",
    purchaseOrderId: "po-1",
    purchaseOrder: { status: "DRAFT" },
    items: [
      {
        barangId: "barang-1",
        jumlah: 5,
        orderedQuantity: 5,
        receivedQuantity: 0,
        cancelledQuantity: 0,
        statusApproval: "APPROVED",
      },
    ],
    jasaItems: [],
    goodsReceipts: [],
    ...overrides,
  };
}

interface DeletionFixture {
  service: RestockRequestDeletionService;
  repository: {
    findPurchaseRequestDetail: ReturnType<typeof vi.fn>;
    deletePurchaseRequestIfDeletable: ReturnType<typeof vi.fn>;
  };
  remover: { removePurchaseOrder: ReturnType<typeof vi.fn> };
  lock: { acquire: ReturnType<typeof vi.fn> };
  release: ReturnType<typeof vi.fn>;
}

function createService(
  request: RestockRequestForDeletion | null,
  removal: RestockOrderRemovalOutcome = "REMOVED",
): DeletionFixture {
  const repository = {
    findPurchaseRequestDetail: vi.fn().mockResolvedValue(request),
    deletePurchaseRequestIfDeletable: vi.fn().mockResolvedValue(true),
  };
  const remover = { removePurchaseOrder: vi.fn().mockResolvedValue(removal) };
  const release = vi.fn().mockResolvedValue(undefined);
  const lock = { acquire: vi.fn().mockResolvedValue(release) };
  return {
    service: new RestockRequestDeletionService(repository, remover, lock),
    repository,
    remover,
    lock,
    release,
  };
}

describe("RestockRequestDeletionService", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("menghapus pesanan DRAFT lebih dulu, lalu pengajuannya, dan mencatat pelakunya", async () => {
    const { service, repository, remover } = createService(approvedRequest());
    const callOrder: string[] = [];
    remover.removePurchaseOrder.mockImplementation(async () => {
      callOrder.push("order");
      return "REMOVED";
    });
    repository.deletePurchaseRequestIfDeletable.mockImplementation(async () => {
      callOrder.push("request");
      return true;
    });

    const result = await service.deleteRestockRequest(command);

    expect(result).toEqual({ success: true, data: { id: "pr-1" } });
    expect(repository.findPurchaseRequestDetail).toHaveBeenCalledWith(
      "pr-1",
      "tenant-1",
    );
    expect(remover.removePurchaseOrder).toHaveBeenCalledWith("po-1");
    expect(callOrder).toEqual(["order", "request"]);
    expect(logActivitySafe).toHaveBeenCalledWith({
      action: "DELETE",
      subject: "Pengajuan Restock PR-20261121-0001",
      userId: "user-1",
      tenantId: "tenant-1",
      details: { purchaseRequestId: "pr-1", purchaseOrderId: "po-1" },
    });
  });

  it.each([
    [
      "menunggu persetujuan",
      approvedRequest({
        status: "DRAFT",
        purchaseOrderId: null,
        purchaseOrder: null,
      }),
    ],
    [
      "ditolak atasan",
      approvedRequest({
        status: "REJECTED",
        purchaseOrderId: null,
        purchaseOrder: null,
      }),
    ],
  ])(
    "menghapus pengajuan %s tanpa pesanan tanpa menyentuh procurement",
    async (_label, request) => {
      const { service, repository, remover } = createService(request);

      const result = await service.deleteRestockRequest(command);

      expect(result.success).toBe(true);
      expect(remover.removePurchaseOrder).not.toHaveBeenCalled();
      expect(repository.deletePurchaseRequestIfDeletable).toHaveBeenCalledWith(
        "pr-1",
        "tenant-1",
      );
    },
  );

  it("mengembalikan NOT_FOUND bila pengajuan tidak ada di tenant ini", async () => {
    const { service, repository, remover } = createService(null);

    const result = await service.deleteRestockRequest(command);

    expect(result).toEqual({
      success: false,
      code: "NOT_FOUND",
      error: RESTOCK_MESSAGES.requestNotFound,
    });
    expect(remover.removePurchaseOrder).not.toHaveBeenCalled();
    expect(repository.deletePurchaseRequestIfDeletable).not.toHaveBeenCalled();
  });

  it.each([
    [
      "sudah dimasukkan",
      approvedRequest({ status: "RECEIVED" }),
      RESTOCK_MESSAGES.cannotDeleteReceived,
    ],
    [
      "sudah ada barang yang masuk",
      approvedRequest({
        items: [
          {
            barangId: "barang-1",
            jumlah: 5,
            orderedQuantity: 5,
            receivedQuantity: 2,
            cancelledQuantity: 0,
            statusApproval: "APPROVED",
          },
        ],
      }),
      RESTOCK_MESSAGES.cannotDeleteAfterEntry,
    ],
    [
      "sudah ada catatan barang masuk",
      approvedRequest({ goodsReceipts: [{ id: "grn-1" }] }),
      RESTOCK_MESSAGES.cannotDeleteAfterEntry,
    ],
    [
      "jasanya sudah ditandai selesai",
      approvedRequest({
        jasaItems: [
          { statusKonfirmasi: "SELESAI", statusApproval: "APPROVED" },
        ],
      }),
      RESTOCK_MESSAGES.cannotDeleteAfterEntry,
    ],
    [
      "pesanannya sudah diproses",
      approvedRequest({ purchaseOrder: { status: "ORDERED" } }),
      RESTOCK_MESSAGES.cannotDeleteProcessedOrder,
    ],
    [
      "pesanannya sudah dibatalkan",
      approvedRequest({
        status: "CANCELLED",
        purchaseOrder: { status: "CANCELLED" },
      }),
      RESTOCK_MESSAGES.cannotDeleteProcessedOrder,
    ],
  ])(
    "menolak tanpa menghapus apa pun bila %s",
    async (_label, request, message) => {
      const { service, repository, remover } = createService(request);

      const result = await service.deleteRestockRequest(command);

      expect(result).toEqual({
        success: false,
        code: "CONFLICT",
        error: message,
      });
      expect(remover.removePurchaseOrder).not.toHaveBeenCalled();
      expect(
        repository.deletePurchaseRequestIfDeletable,
      ).not.toHaveBeenCalled();
      expect(logActivitySafe).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "HAS_LEGACY_PURCHASES" as const,
      RESTOCK_MESSAGES.cannotDeleteWithLegacyPurchases,
    ],
    ["LOCKED" as const, RESTOCK_MESSAGES.cannotDeleteAfterEntry],
  ])(
    "membiarkan pengajuan bila procurement menolak menghapus pesanannya (%s)",
    async (removal, message) => {
      const { service, repository } = createService(approvedRequest(), removal);

      const result = await service.deleteRestockRequest(command);

      expect(result).toEqual({
        success: false,
        code: "CONFLICT",
        error: message,
      });
      expect(
        repository.deletePurchaseRequestIfDeletable,
      ).not.toHaveBeenCalled();
      expect(logActivitySafe).not.toHaveBeenCalled();
    },
  );

  it("tidak menghitung barang masuk di baris yang ditolak atasan", async () => {
    const { service, repository } = createService(
      approvedRequest({
        items: [
          {
            barangId: "barang-2",
            jumlah: 3,
            receivedQuantity: 3,
            statusApproval: "REJECTED",
          },
          {
            barangId: "barang-1",
            jumlah: 5,
            orderedQuantity: 5,
            receivedQuantity: 0,
            cancelledQuantity: 0,
            statusApproval: "APPROVED",
          },
        ],
      }),
    );

    const result = await service.deleteRestockRequest(command);

    expect(result.success).toBe(true);
    expect(repository.deletePurchaseRequestIfDeletable).toHaveBeenCalledWith(
      "pr-1",
      "tenant-1",
    );
  });

  describe("kunci pengajuan dan penghapusan bersyarat", () => {
    it("membaca pengajuan sesudah kunci didapat, dan melepas kunci sesudah selesai", async () => {
      const { service, repository, lock, release } =
        createService(approvedRequest());

      await service.deleteRestockRequest(command);

      expect(lock.acquire).toHaveBeenCalledWith("pr-1");
      expect(lock.acquire.mock.invocationCallOrder[0]).toBeLessThan(
        repository.findPurchaseRequestDetail.mock.invocationCallOrder[0],
      );
      expect(release).toHaveBeenCalledTimes(1);
    });

    it("menolak 409 tanpa membaca apa pun bila Masukkan Barang atau Batalkan sedang memegang kunci", async () => {
      const { service, repository, remover, lock } =
        createService(approvedRequest());
      lock.acquire.mockResolvedValue(null);

      const result = await service.deleteRestockRequest(command);

      expect(result).toEqual({
        success: false,
        code: "CONFLICT",
        error: RESTOCK_REQUEST_BUSY_MESSAGE,
      });
      expect(repository.findPurchaseRequestDetail).not.toHaveBeenCalled();
      expect(remover.removePurchaseOrder).not.toHaveBeenCalled();
      expect(
        repository.deletePurchaseRequestIfDeletable,
      ).not.toHaveBeenCalled();
    });

    it("menolak 409 tanpa mencatat log bila pesanan baru saja dibuat untuk pengajuan ini", async () => {
      const { service, repository, release } = createService(
        approvedRequest({
          status: "APPROVED",
          purchaseOrderId: null,
          purchaseOrder: null,
        }),
      );
      repository.deletePurchaseRequestIfDeletable.mockResolvedValue(false);

      const result = await service.deleteRestockRequest(command);

      expect(result).toMatchObject({
        success: false,
        code: "CONFLICT",
        error: expect.stringContaining("baru saja diubah"),
      });
      expect(logActivitySafe).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledTimes(1);
    });

    it("kunci tetap dilepas bila penghapusan gagal tak terduga", async () => {
      const { service, repository, release } = createService(approvedRequest());
      repository.deletePurchaseRequestIfDeletable.mockRejectedValue(
        new Error("db down"),
      );

      await expect(service.deleteRestockRequest(command)).rejects.toThrow(
        "db down",
      );
      expect(release).toHaveBeenCalledTimes(1);
    });
  });
});
