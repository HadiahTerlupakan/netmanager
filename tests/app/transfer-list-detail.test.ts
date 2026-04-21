import { describe, expect, it, vi } from "vitest";

import { fetchTransferDetail } from "@/app/admin/inventory/transfer/TransferList";

describe("fetchTransferDetail", () => {
  it("loads detail transfer from detail endpoint", async () => {
    const getWithAuth = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          transfer: {
            id: "transfer-1",
            kodeTransfer: "TRF-001",
            masuk: {
              tanggal: "2026-01-01T08:00:00.000Z",
              keterangan: "Transfer dari Gudang Pusat",
            },
            keluar: {
              tanggal: "2026-01-01T07:00:00.000Z",
              keterangan: "Transfer ke Gudang Cabang",
            },
          },
        },
      }),
    });

    const result = await fetchTransferDetail(getWithAuth, "transfer-1");

    expect(getWithAuth).toHaveBeenCalledWith(
      "/api/inventory/transfer/transfer-1",
    );
    expect(result).toMatchObject({
      id: "transfer-1",
      kodeTransfer: "TRF-001",
      masuk: {
        keterangan: "Transfer dari Gudang Pusat",
      },
      keluar: {
        keterangan: "Transfer ke Gudang Cabang",
      },
    });
  });
});
