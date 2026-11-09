import { describe, expect, it, vi } from "vitest";

import { RestockPurchaseSignatureReader } from "@/modules/inventory/services/RestockPurchaseSignatureReader";

const INPUT = {
  purchaseRequestId: "pr-1",
  recordId: "rec-1",
  tenantId: "tenant-1",
};

function setup(key: string | null) {
  const records = { findSignatureKey: vi.fn().mockResolvedValue(key) };
  const storage = { read: vi.fn().mockResolvedValue(Buffer.from("png")) };
  return {
    records,
    storage,
    reader: new RestockPurchaseSignatureReader(records, storage),
  };
}

describe("RestockPurchaseSignatureReader", () => {
  it("membaca kunci di awalan tenant/pengajuan", async () => {
    const { storage, reader } = setup(
      "restock-belanja/tenant-1/pr-1/ttd-a.png",
    );

    expect(await reader.read(INPUT)).toEqual(Buffer.from("png"));
    expect(storage.read).toHaveBeenCalledWith(
      "restock-belanja/tenant-1/pr-1/ttd-a.png",
    );
  });

  it("null bila catatan bukan milik pengajuan/tenant (kunci tidak ditemukan)", async () => {
    const { storage, reader } = setup(null);

    expect(await reader.read(INPUT)).toBeNull();
    expect(storage.read).not.toHaveBeenCalled();
  });

  it.each([
    "restock-belanja/tenant-2/pr-1/ttd-a.png",
    "restock-belanja/tenant-1/pr-2/ttd-a.png",
    "pengesahan/tenant-1/x/ttd.png",
  ])("null untuk kunci berawalan asing %s", async (key) => {
    const { storage, reader } = setup(key);

    expect(await reader.read(INPUT)).toBeNull();
    expect(storage.read).not.toHaveBeenCalled();
  });
});
