import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { InvestorProfitShareService } from "@/modules/investor/services/InvestorProfitShareService";

const repo = { findById: vi.fn(), updateStatus: vi.fn() };
const service = new InvestorProfitShareService(repo as never);

describe("InvestorProfitShareService.cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.updateStatus.mockImplementation(async (id: string, data: object) => ({ id, ...data }));
  });

  it("bagi hasil belum dibayar bisa dibatalkan (bulannya terbuka lagi)", async () => {
    repo.findById.mockResolvedValue({ id: "ph-1", status: "APPROVED" });
    await expect(service.cancel("ph-1")).resolves.toMatchObject({ status: "CANCELLED" });
  });

  it("yang sudah dibayar tidak bisa dibatalkan; yang sudah batal tidak diubah", async () => {
    repo.findById.mockResolvedValueOnce({ id: "ph-1", status: "PAID" });
    await expect(service.cancel("ph-1")).rejects.toThrow("sudah dibayar");

    repo.findById.mockResolvedValueOnce({ id: "ph-2", status: "CANCELLED" });
    await service.cancel("ph-2");
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });
});
