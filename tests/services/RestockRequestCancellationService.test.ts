import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logActivitySafe }));

import type {
  IRestockRequestClosureRepository,
  RestockPurchaseOrderForReceipt,
  RestockPurchaseOrderItem,
  RestockPurchaseRequestForReceipt,
} from "@/modules/inventory/domain/ports/IRestockGoodsReceiptRepository";
import { RestockRequestCancellationService } from "@/modules/inventory/services/RestockRequestCancellationService";
import { RESTOCK_MESSAGES } from "@/modules/inventory/services/restock-messages";
import { RESTOCK_REQUEST_BUSY_MESSAGE } from "@/modules/inventory/services/restock-request-lock";

const command = {
  id: "pr-1",
  tenantId: "tenant-1",
  actorId: "user-1",
  alasan: "Tidak jadi dibutuhkan",
};

const kabel: RestockPurchaseOrderItem = {
  id: "poi-1",
  barangId: "b-1",
  quantity: 10,
  receivedQuantity: 0,
  cancelledQuantity: 0,
  barang: { id: "b-1", nama: "Kabel Fiber" },
};

/** Pengajuan disetujui dengan pesanan po-1 yang belum menerima apa pun. */
function approvedRequest(
  overrides: Partial<RestockPurchaseRequestForReceipt> = {},
): RestockPurchaseRequestForReceipt {
  return {
    id: "pr-1",
    purchaseOrderId: "po-1",
    gudangId: "g-1",
    status: "ORDERED",
    nomorRequest: "PR-20261121-0001",
    lines: [{ barangId: "b-1", jumlah: 10, barang: kabel.barang }],
    jasaItems: [],
    ...overrides,
  };
}

function untouchedOrder(
  overrides: Partial<RestockPurchaseOrderForReceipt> = {},
): RestockPurchaseOrderForReceipt {
  return {
    id: "po-1",
    status: "ORDERED",
    paymentStatus: "UNPAID",
    jasaItemCount: 0,
    goodsReceiptIds: [],
    hasLegacyPurchases: false,
    items: [kabel],
    ...overrides,
  };
}

interface CancellationFixture {
  service: RestockRequestCancellationService;
  repository: {
    findPurchaseRequestForReceipt: Mock;
    findPurchaseOrderWithItems: Mock;
    countPurchaseRequestsForPurchaseOrder: Mock;
    closeRequest: Mock;
    cancelRequestWithoutOrder: Mock;
  };
  lock: { acquire: Mock };
  release: Mock;
}

function createService(
  request: RestockPurchaseRequestForReceipt | null = approvedRequest(),
  order: RestockPurchaseOrderForReceipt | null = untouchedOrder(),
  linkedRequests = 1,
): CancellationFixture {
  const release = vi.fn().mockResolvedValue(undefined);
  const repository = {
    findPurchaseRequestForReceipt: vi.fn().mockResolvedValue(request),
    findPurchaseOrderWithItems: vi.fn().mockResolvedValue(order),
    countPurchaseRequestsForPurchaseOrder: vi
      .fn()
      .mockResolvedValue(linkedRequests),
    closeRequest: vi
      .fn()
      .mockResolvedValue({ isWritten: true, isLastOpenRequest: true }),
    cancelRequestWithoutOrder: vi.fn().mockResolvedValue(true),
  };
  const lock = { acquire: vi.fn().mockResolvedValue(release) };
  return {
    service: new RestockRequestCancellationService(
      repository as unknown as IRestockRequestClosureRepository,
      lock,
    ),
    repository,
    lock,
    release,
  };
}

describe("RestockRequestCancellationService", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("membatalkan pesanan yang belum tersentuh beserta pengajuannya, sisanya dicoret dengan alasan admin", async () => {
    const { service, repository, release } = createService();

    const result = await service.cancelRestockRequest(command);

    expect(result).toEqual({
      success: true,
      data: { id: "pr-1", status: "CANCELLED" },
    });
    expect(repository.closeRequest).toHaveBeenCalledWith({
      purchaseOrderId: "po-1",
      purchaseRequestId: "pr-1",
      ifOtherRequestsOpen: "CANCEL_REQUEST",
      ifLastOpenRequest: {
        settlement: "CANCEL_ORDER",
        cancellations: [
          {
            purchaseOrderItemId: "poi-1",
            cancelledQuantity: 10,
            reason: "Tidak jadi dibutuhkan",
            expected: {
              quantity: 10,
              receivedQuantity: 0,
              cancelledQuantity: 0,
            },
          },
        ],
      },
      actorId: "user-1",
      cancelledAt: expect.any(Date),
      cancelReason: "Tidak jadi dibutuhkan",
    });
    expect(release).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["punya baris jasa", { jasaItemCount: 1 }],
    ["sudah dibayar", { paymentStatus: "PAID" }],
    ["punya catatan belanja lama", { hasLegacyPurchases: true }],
  ])(
    "hanya membatalkan pengajuan dan menutup pesanan yang %s",
    async (_label, overrides) => {
      const { service, repository } = createService(
        approvedRequest(),
        untouchedOrder(overrides),
      );

      await service.cancelRestockRequest(command);

      expect(repository.closeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          ifLastOpenRequest: expect.objectContaining({
            settlement: "CANCEL_REQUEST_AND_SETTLE_ORDER",
          }),
          cancelReason: "Tidak jadi dibutuhkan",
        }),
      );
    },
  );

  it("pada pesanan gabungan: selama pengajuan lain terbuka hanya pengajuan ini yang dibatalkan; pengajuan terakhir mencoret semua sisa dan menutup pesanannya", async () => {
    const milikLain: RestockPurchaseOrderItem = {
      ...kabel,
      id: "poi-2",
      barangId: "b-2",
      barang: { id: "b-2", nama: "Konektor" },
    };
    const { service, repository } = createService(
      approvedRequest(),
      untouchedOrder({ items: [kabel, milikLain] }),
      2,
    );

    await service.cancelRestockRequest(command);

    expect(repository.closeRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        ifOtherRequestsOpen: "CANCEL_REQUEST",
        ifLastOpenRequest: {
          settlement: "CANCEL_REQUEST_AND_SETTLE_ORDER",
          cancellations: [
            expect.objectContaining({
              purchaseOrderItemId: "poi-1",
              cancelledQuantity: 10,
              reason: "Tidak jadi dibutuhkan",
            }),
            expect.objectContaining({
              purchaseOrderItemId: "poi-2",
              cancelledQuantity: 10,
              reason: "Tidak jadi dibutuhkan",
            }),
          ],
        },
      }),
    );
  });

  it("pada pesanan gabungan, barang masuk milik pengajuan lain tidak menahan pembatalan", async () => {
    const { service, repository } = createService(
      approvedRequest(),
      untouchedOrder({
        status: "PARTIAL",
        goodsReceiptIds: ["grn-milik-pengajuan-lain"],
        items: [{ ...kabel, quantity: 15, receivedQuantity: 5 }],
      }),
      2,
    );

    const result = await service.cancelRestockRequest(command);

    expect(result).toEqual({
      success: true,
      data: { id: "pr-1", status: "CANCELLED" },
    });
    expect(repository.closeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ ifOtherRequestsOpen: "CANCEL_REQUEST" }),
    );
  });

  it("membatalkan pengajuan yang pesanannya belum dibuat tanpa menyentuh pesanan", async () => {
    const { service, repository } = createService(
      approvedRequest({ status: "APPROVED", purchaseOrderId: null }),
      null,
    );

    const result = await service.cancelRestockRequest(command);

    expect(result.success).toBe(true);
    expect(repository.cancelRequestWithoutOrder).toHaveBeenCalledWith({
      purchaseRequestId: "pr-1",
      tenantId: "tenant-1",
      cancelReason: "Tidak jadi dibutuhkan",
    });
    expect(repository.findPurchaseOrderWithItems).not.toHaveBeenCalled();
    expect(repository.closeRequest).not.toHaveBeenCalled();
  });

  it("mencatat pembatalan beserta alasannya di Log Aktivitas", async () => {
    const { service } = createService();

    await service.cancelRestockRequest(command);

    expect(logActivitySafe).toHaveBeenCalledWith({
      action: "CANCEL",
      subject: "Pengajuan Restock PR-20261121-0001",
      userId: "user-1",
      tenantId: "tenant-1",
      details: {
        purchaseRequestId: "pr-1",
        purchaseOrderId: "po-1",
        alasan: "Tidak jadi dibutuhkan",
      },
    });
  });

  it.each([
    [
      "belum disetujui",
      approvedRequest({ status: "DRAFT", purchaseOrderId: null }),
      null,
      "belum disetujui",
    ],
    [
      "sudah ada barang yang masuk",
      approvedRequest(),
      untouchedOrder({ items: [{ ...kabel, receivedQuantity: 4 }] }),
      "sudah ada barang yang masuk gudang",
    ],
    [
      "jasanya sudah ditandai selesai",
      approvedRequest({ jasaItems: [{ statusKonfirmasi: "SELESAI" }] }),
      untouchedOrder({ jasaItemCount: 1 }),
      "jasa yang ditandai selesai",
    ],
    [
      "sudah selesai",
      approvedRequest({ status: "RECEIVED" }),
      untouchedOrder({ status: "RECEIVED" }),
      "sudah selesai",
    ],
    [
      "sudah dibatalkan",
      approvedRequest({ status: "CANCELLED" }),
      untouchedOrder({ status: "CANCELLED" }),
      "sudah dibatalkan",
    ],
    [
      "sudah ditolak",
      approvedRequest({ status: "REJECTED", purchaseOrderId: null }),
      null,
      "sudah ditolak",
    ],
    [
      "jasa saja yang sebagian jasanya sudah selesai",
      approvedRequest({
        lines: [],
        jasaItems: [
          { statusKonfirmasi: "SELESAI" },
          { statusKonfirmasi: "PENDING" },
        ],
      }),
      untouchedOrder({ items: [], jasaItemCount: 2 }),
      "Tandai jasa yang tersisa selesai lewat Konfirmasi Jasa",
    ],
  ])(
    "menolak dengan 409 pengajuan yang %s tanpa menulis apa pun",
    async (_label, request, order, message) => {
      const { service, repository } = createService(request, order);

      const result = await service.cancelRestockRequest(command);

      expect(result).toMatchObject({
        success: false,
        code: "CONFLICT",
        error: expect.stringContaining(message),
      });
      expect(repository.closeRequest).not.toHaveBeenCalled();
      expect(repository.cancelRequestWithoutOrder).not.toHaveBeenCalled();
      expect(logActivitySafe).not.toHaveBeenCalled();
    },
  );

  it("pada pesanan gabungan, jasa pengajuan ini yang sudah selesai tetap menahan pembatalan", async () => {
    const { service, repository } = createService(
      approvedRequest({ jasaItems: [{ statusKonfirmasi: "SELESAI" }] }),
      untouchedOrder({ jasaItemCount: 1 }),
      2,
    );

    const result = await service.cancelRestockRequest(command);

    expect(result).toMatchObject({
      success: false,
      code: "CONFLICT",
      error: expect.stringContaining('"Selesaikan tanpa barang tambahan"'),
    });
    expect(repository.closeRequest).not.toHaveBeenCalled();
  });

  it("pesan tolak pengajuan jasa saja tidak menyuruh Masukkan Barang", async () => {
    const { service } = createService(
      approvedRequest({
        lines: [],
        jasaItems: [
          { statusKonfirmasi: "SELESAI" },
          { statusKonfirmasi: "PENDING" },
        ],
      }),
      untouchedOrder({ items: [], jasaItemCount: 2 }),
    );

    const result = await service.cancelRestockRequest(command);

    expect(result.success).toBe(false);
    expect(result.success === false && result.error).not.toContain(
      "Masukkan Barang",
    );
  });

  it("pesan tolak pengajuan berbarang menunjukkan jalan keluar lewat Masukkan Barang", async () => {
    const { service } = createService(
      approvedRequest(),
      untouchedOrder({ items: [{ ...kabel, receivedQuantity: 4 }] }),
    );

    const result = await service.cancelRestockRequest(command);

    expect(result).toMatchObject({
      success: false,
      code: "CONFLICT",
      error: expect.stringContaining(
        'Selesaikan lewat Masukkan Barang. Kalau tidak ada barang lagi yang datang, isi semua jumlah dengan 0, lalu pilih "Selesaikan tanpa barang tambahan".',
      ),
    });
  });

  it("menjawab 404 untuk pengajuan yang tidak ada di tenant ini", async () => {
    const { service } = createService(null);

    await expect(service.cancelRestockRequest(command)).resolves.toEqual({
      success: false,
      code: "NOT_FOUND",
      error: RESTOCK_MESSAGES.requestNotFound,
    });
  });

  it("menolak dengan 409 bila pengajuan berubah di tengah jalan", async () => {
    const { service, repository } = createService();
    repository.closeRequest.mockResolvedValue({ isWritten: false });

    const result = await service.cancelRestockRequest(command);

    expect(result).toMatchObject({
      success: false,
      code: "CONFLICT",
      error: expect.stringContaining("baru saja diubah"),
    });
    expect(logActivitySafe).not.toHaveBeenCalled();
  });

  it("menolak dengan 409 bila pengajuan sedang diproses, tanpa membacanya", async () => {
    const { service, repository, lock } = createService();
    lock.acquire.mockResolvedValue(null);

    await expect(service.cancelRestockRequest(command)).resolves.toEqual({
      success: false,
      code: "CONFLICT",
      error: RESTOCK_REQUEST_BUSY_MESSAGE,
    });
    expect(lock.acquire).toHaveBeenCalledWith("pr-1");
    expect(repository.findPurchaseRequestForReceipt).not.toHaveBeenCalled();
  });
});
