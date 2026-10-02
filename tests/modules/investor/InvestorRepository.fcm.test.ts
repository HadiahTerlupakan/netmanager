import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { InvestorRepository } from "@/modules/investor/repositories/InvestorRepository";

const tx = {
  investor: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
};
const client = {
  ...tx,
  $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
};
const repo = new InvestorRepository(client as never);

describe("InvestorRepository — token FCM", () => {
  beforeEach(() => vi.clearAllMocks());

  it("token baru ditambahkan di akhir, dilepas dari investor lain, maksimal 5 terbaru", async () => {
    tx.investor.findUnique.mockResolvedValue({ fcmTokens: ["t1", "t2", "t3", "t4", "t5"] });
    tx.investor.findMany.mockResolvedValue([{ id: "inv-lain", fcmTokens: ["x", "baru"] }]);

    await expect(repo.addFcmToken("inv-1", "baru")).resolves.toBe(true);

    expect(tx.investor.update).toHaveBeenCalledWith({
      where: { id: "inv-lain" },
      data: { fcmTokens: { set: ["x"] } },
    });
    expect(tx.investor.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { fcmTokens: { set: ["t2", "t3", "t4", "t5", "baru"] }, pushTokenUpdatedAt: expect.any(Date) },
    });
  });

  it("token yang sudah ada tidak digandakan; investor tidak ada → false", async () => {
    tx.investor.findUnique.mockResolvedValueOnce({ fcmTokens: ["a", "b"] });
    tx.investor.findMany.mockResolvedValueOnce([]);
    await repo.addFcmToken("inv-1", "a");
    expect(tx.investor.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fcmTokens: { set: ["b", "a"] } }) }),
    );

    tx.investor.findUnique.mockResolvedValueOnce(null);
    await expect(repo.addFcmToken("tidak-ada", "a")).resolves.toBe(false);
  });

  it("investor nonaktif tidak menerima push", async () => {
    client.investor.findFirst.mockResolvedValueOnce({ fcmTokens: ["a"], isActive: false });
    await expect(repo.findFcmTokens("inv-1", "tenant-1")).resolves.toEqual([]);
  });

  it("token hanya diambil dari investor di tenant asal event", async () => {
    client.investor.findFirst.mockResolvedValueOnce(null);
    await expect(repo.findFcmTokens("inv-1", "tenant-lain")).resolves.toEqual([]);
    expect(client.investor.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inv-1", tenantId: "tenant-lain" } }),
    );
  });
});
