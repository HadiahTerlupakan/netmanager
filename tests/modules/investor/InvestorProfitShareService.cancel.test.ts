import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { InvestorProfitShareService } from "@/modules/investor/services/InvestorProfitShareService";

const repo = { findById: vi.fn(), updateStatus: vi.fn(), batalkan: vi.fn() };
const service = new InvestorProfitShareService(repo as never);

describe("InvestorProfitShareService.cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.batalkan.mockImplementation(async (id: string) => ({ id, status: "CANCELLED" }));
  });

  it("bagi hasil belum dibayar bisa dibatalkan (bulannya terbuka lagi)", async () => {
    repo.findById.mockResolvedValue({ id: "ph-1", status: "APPROVED" });
    await expect(service.cancel("ph-1", "t-1")).resolves.toMatchObject({ status: "CANCELLED" });
    expect(repo.findById).toHaveBeenCalledWith("ph-1", "t-1");
    // batalkan = ubah status + lepas penjaga bulan dalam satu transaksi (repository).
    expect(repo.batalkan).toHaveBeenCalledWith("ph-1", "t-1");
  });

  it("yang sudah dibayar tidak bisa dibatalkan; yang sudah batal tidak diubah", async () => {
    repo.findById.mockResolvedValueOnce({ id: "ph-1", status: "PAID" });
    await expect(service.cancel("ph-1", "t-1")).rejects.toThrow("sudah dibayar");

    repo.findById.mockResolvedValueOnce({ id: "ph-2", status: "CANCELLED" });
    await service.cancel("ph-2", "t-1");
    expect(repo.batalkan).not.toHaveBeenCalled();
  });
});
