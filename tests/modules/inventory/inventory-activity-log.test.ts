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
