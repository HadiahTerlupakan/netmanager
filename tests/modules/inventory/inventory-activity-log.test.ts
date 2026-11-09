import { beforeEach, describe, expect, it, vi } from "vitest";

const { logActivitySafe } = vi.hoisted(() => ({ logActivitySafe: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logActivitySafe }));

import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "@/modules/inventory/services/inventory-activity-log";

describe("recordInventoryActivity", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("menulis subjek berawalan jenis dokumen dan referensinya", () => {
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.DELETE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.TRANSFER,
      reference: "TRF-20261017-0001",
      actorId: "user-1",
      tenantId: "tenant-1",
      details: { jumlah: 5 },
    });

    expect(logActivitySafe).toHaveBeenCalledWith({
      action: "DELETE",
      subject: "Transfer Barang TRF-20261017-0001",
      userId: "user-1",
      tenantId: "tenant-1",
      details: { jumlah: 5 },
    });
  });

  it("menyerahkan tenant kosong ke logger untuk diisi dari pelaku", () => {
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.UPDATE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.BARANG_MASUK,
      reference: "Kabel 1 core",
      actorId: "user-1",
      tenantId: null,
    });

    expect(logActivitySafe.mock.calls[0][0].tenantId).toBeUndefined();
  });
});

describe("recordInventoryActivity pelaku link", () => {
  beforeEach(() => logActivitySafe.mockReset());

  it("memakai actor non-user dan meneruskan IP/UA tanpa userId", () => {
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.RECORD_PURCHASE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.PURCHASE_ORDER,
      reference: "PO-1",
      externalActor: { type: "purchase_link", id: "link-1" },
      tenantId: "tenant-1",
      ipAddress: "10.0.0.1",
      userAgent: "HP",
    });

    const entry = logActivitySafe.mock.calls[0][0];
    expect(entry.actor).toEqual({ type: "purchase_link", id: "link-1" });
    expect(entry.userId).toBeUndefined();
    expect(entry.ipAddress).toBe("10.0.0.1");
    expect(entry.userAgent).toBe("HP");
  });
});
