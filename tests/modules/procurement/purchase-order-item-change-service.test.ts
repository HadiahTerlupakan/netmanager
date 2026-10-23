import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ logActivity: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  logger: {
    logActivity: mocks.logActivity,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { ApprovalThresholdExceededError } from "@/modules/procurement/services/ApprovalThresholdService";
import {
  PurchaseOrderItemChangeInvalidError,
  PurchaseOrderItemChangeService,
} from "@/modules/procurement/services/PurchaseOrderItemChangeService";
import {
  PurchaseOrderNotEditableError,
  PurchaseOrderNotFoundError,
} from "@/modules/procurement/services/PurchaseOrderService";
import type { PurchaseOrderForItemChange } from "@/modules/procurement/domain/ports/IPurchaseOrderItemChangeRepository";

function purchaseOrder(
  overrides: Partial<PurchaseOrderForItemChange> = {},
): PurchaseOrderForItemChange {
  return {
    id: "po-1",
    poNumber: "PO/2026/10/0008",
    tenantId: "tenant-1",
    status: "PARTIAL",
    grandTotal: 40_000_000,
    ppnRate: 0,
    items: [
      {
        id: "poi-4core",
        barangId: "b-4core",
        barangName: "Kabel 4 Core",
        quantity: 4000,
        receivedQuantity: 0,
        cancelledQuantity: 0,
        unitPrice: 10_000,
      },
    ],
    purchaseRequestIds: ["pr-old", "pr-new"],
    ...overrides,
  };
}

function createService(
  po: PurchaseOrderForItemChange | null = purchaseOrder(),
) {
  const repository = {
    findForItemChange: vi.fn().mockResolvedValue(po),
    findBarangs: vi
      .fn()
      .mockResolvedValue([{ id: "b-2core", nama: "Kabel 2 Core" }]),
    applyItemChange: vi.fn().mockResolvedValue({
      status: "PARTIAL",
      paymentStatus: "UNPAID",
      grandTotal: 34_000_000,
    }),
  };
  const approval = { assertCanApprove: vi.fn().mockResolvedValue(undefined) };
  const service = new PurchaseOrderItemChangeService(
    repository,
    approval as never,
  );
  return { service, repository, approval };
}

const splitCable = {
  purchaseOrderId: "po-1",
  tenantId: "tenant-1",
  actorId: "user-1",
  actorRoleIds: ["role-purchasing"],
  reason: "Supplier mengirim sebagian sebagai kabel 2 core",
  changes: [{ id: "poi-4core", quantity: 2000 }],
  additions: [{ barangId: "b-2core", quantity: 2000, unitPrice: 7_000 }],
};

describe("PurchaseOrderItemChangeService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("splits a line into a smaller quantity and a new barang on the same PO", async () => {
    const { service, repository } = createService();

    await service.changeItems(splitCable);

    expect(repository.applyItemChange).toHaveBeenCalledWith(
      {
        purchaseOrderId: "po-1",
        poNumber: "PO/2026/10/0008",
        tenantId: "tenant-1",
        actorId: "user-1",
        quantityChanges: [{ purchaseOrderItemId: "poi-4core", quantity: 2000 }],
        additions: [{ barangId: "b-2core", quantity: 2000, unitPrice: 7_000 }],
        purchaseRequestId: "pr-old",
      },
      expect.any(Function),
    );
  });

  describe("re-checking against the locked PO inside the transaction", () => {
    function lockedAs(locked: PurchaseOrderForItemChange) {
      const { service, repository } = createService();
      repository.applyItemChange.mockImplementation(
        async (_input: unknown, assertStillValid: (po: unknown) => void) => {
          assertStillValid(locked);
          return { status: "PARTIAL", paymentStatus: "UNPAID", grandTotal: 0 };
        },
      );
      return service;
    }

    it("refuses a reduction below goods received in the meantime", async () => {
      const locked = purchaseOrder();
      locked.items[0] = { ...locked.items[0], receivedQuantity: 3000 };

      await expect(lockedAs(locked).changeItems(splitCable)).rejects.toThrow(
        "Jumlah Kabel 4 Core minimal 3000 karena sudah diterima 3000",
      );
    });

    it("refuses a PO that was closed in the meantime", async () => {
      await expect(
        lockedAs(purchaseOrder({ status: "RECEIVED" })).changeItems(splitCable),
      ).rejects.toBeInstanceOf(PurchaseOrderNotEditableError);
    });

    it("refuses a barang another change added in the meantime", async () => {
      const locked = purchaseOrder();
      locked.items.push({
        id: "poi-2core",
        barangId: "b-2core",
        barangName: "Kabel 2 Core",
        quantity: 2000,
        receivedQuantity: 0,
        cancelledQuantity: 0,
        unitPrice: 7_000,
      });

      await expect(lockedAs(locked).changeItems(splitCable)).rejects.toThrow(
        "Kabel 2 Core sudah ada di pesanan ini",
      );
    });
  });

  it("records the reason and what changed in the activity log", async () => {
    const { service } = createService();

    await service.changeItems(splitCable);

    expect(mocks.logActivity).toHaveBeenCalledWith({
      userId: "user-1",
      tenantId: "tenant-1",
      action: "CHANGE_ITEMS PurchaseOrder",
      subject: "PO/2026/10/0008",
      details: {
        purchaseOrderId: "po-1",
        alasan: "Supplier mengirim sebagian sebagai kabel 2 core",
        perubahanJumlah: [
          { barang: "Kabel 4 Core", dari: 4000, menjadi: 2000 },
        ],
        barangTambahan: [
          { barang: "Kabel 2 Core", jumlah: 2000, hargaSatuan: 7_000 },
        ],
        grandTotalSebelum: 40_000_000,
        grandTotalSesudah: 34_000_000,
      },
    });
  });

  it.each(["RECEIVED", "CANCELLED"] as const)(
    "refuses a %s purchase order",
    async (status) => {
      const { service, repository } = createService(purchaseOrder({ status }));

      await expect(service.changeItems(splitCable)).rejects.toBeInstanceOf(
        PurchaseOrderNotEditableError,
      );
      expect(repository.applyItemChange).not.toHaveBeenCalled();
    },
  );

  it("reports a missing purchase order", async () => {
    const { service } = createService(null);

    await expect(service.changeItems(splitCable)).rejects.toBeInstanceOf(
      PurchaseOrderNotFoundError,
    );
  });

  it("refuses a purchase order from another tenant", async () => {
    const { service } = createService(purchaseOrder({ tenantId: "tenant-2" }));

    await expect(service.changeItems(splitCable)).rejects.toBeInstanceOf(
      PurchaseOrderNotFoundError,
    );
  });

  it("will not go below what has already been received and cancelled", async () => {
    const po = purchaseOrder();
    po.items[0] = {
      ...po.items[0],
      receivedQuantity: 1500,
      cancelledQuantity: 600,
    };
    const { service, repository } = createService(po);

    await expect(
      service.changeItems({ ...splitCable, additions: [] }),
    ).rejects.toThrow(
      "Jumlah Kabel 4 Core minimal 2100 karena sudah diterima 1500 dan dianulir 600",
    );
    expect(repository.applyItemChange).not.toHaveBeenCalled();
  });

  it("will not reduce a line to zero", async () => {
    const { service } = createService();

    await expect(
      service.changeItems({
        ...splitCable,
        changes: [{ id: "poi-4core", quantity: 0 }],
      }),
    ).rejects.toBeInstanceOf(PurchaseOrderItemChangeInvalidError);
  });

  it("refuses an item that is not on this purchase order", async () => {
    const { service } = createService();

    await expect(
      service.changeItems({
        ...splitCable,
        changes: [{ id: "poi-other", quantity: 10 }],
      }),
    ).rejects.toThrow("Item tidak ada di Purchase Order ini");
  });

  it("asks to change the quantity instead of adding a barang already ordered", async () => {
    const { service } = createService();

    await expect(
      service.changeItems({
        ...splitCable,
        additions: [{ barangId: "b-4core", quantity: 10, unitPrice: 1 }],
      }),
    ).rejects.toThrow(
      "Kabel 4 Core sudah ada di pesanan ini. Ubah jumlahnya, jangan ditambah",
    );
  });

  it("refuses a barang that is not in this tenant's master data", async () => {
    const { service, repository } = createService();
    repository.findBarangs.mockResolvedValue([]);

    await expect(service.changeItems(splitCable)).rejects.toThrow(
      "Barang tambahan tidak ditemukan pada master barang",
    );
  });

  it("refuses the same barang added twice", async () => {
    const { service } = createService();
    const addition = { barangId: "b-2core", quantity: 1, unitPrice: 1 };

    await expect(
      service.changeItems({ ...splitCable, additions: [addition, addition] }),
    ).rejects.toThrow("Barang tambahan tidak boleh dobel");
  });

  it("refuses a request that changes nothing", async () => {
    const { service } = createService();

    await expect(
      service.changeItems({
        ...splitCable,
        changes: [{ id: "poi-4core", quantity: 4000 }],
        additions: [],
      }),
    ).rejects.toThrow("Tidak ada perubahan isi pesanan");
  });

  it("checks the approval limit when the total grows", async () => {
    const { service, approval } = createService(purchaseOrder({ ppnRate: 11 }));

    await service.changeItems({
      ...splitCable,
      changes: [],
      additions: [{ barangId: "b-2core", quantity: 100, unitPrice: 10_000 }],
    });

    // 40 jt + 1 jt × 1,11.
    expect(approval.assertCanApprove).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      scope: "PURCHASE_ORDER",
      amount: 41_110_000,
      roleIds: ["role-purchasing"],
    });
  });

  it("skips the approval limit when the total shrinks", async () => {
    const { service, approval } = createService();

    await service.changeItems(splitCable);

    expect(approval.assertCanApprove).not.toHaveBeenCalled();
  });

  it("stops before writing when the approval limit is exceeded", async () => {
    const { service, repository, approval } = createService();
    approval.assertCanApprove.mockRejectedValue(
      new ApprovalThresholdExceededError("PURCHASE_ORDER", 1),
    );

    await expect(
      service.changeItems({ ...splitCable, changes: [] }),
    ).rejects.toBeInstanceOf(ApprovalThresholdExceededError);
    expect(repository.applyItemChange).not.toHaveBeenCalled();
  });
});
