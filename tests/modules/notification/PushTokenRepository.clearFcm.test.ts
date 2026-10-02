import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const model = () => ({ findMany: vi.fn(), update: vi.fn() });
  return { prisma: { user: model() }, prismaMitra: { mitra: model() } };
});
const investorQueries = vi.hoisted(() => ({
  findInvestorFcmTokenOwners: vi.fn(),
  replaceInvestorFcmTokens: vi.fn(),
}));

vi.mock("@/modules/database", () => db);
vi.mock("@/modules/investor/public-queries", () => investorQueries);

import { PushTokenRepository } from "@/modules/notification/repositories/PushTokenRepository";

describe("PushTokenRepository.clearFcmTokensFromArrays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.prisma.user.findMany.mockResolvedValue([{ id: "u-1", fcmTokens: ["mati", "hidup"] }]);
    db.prismaMitra.mitra.findMany.mockResolvedValue([{ id: "m-1", fcmTokens: ["hidup"] }]);
    investorQueries.findInvestorFcmTokenOwners.mockResolvedValue([{ id: "i-1", fcmTokens: ["mati"] }]);
  });

  it("melepas token mati dari user, mitra, dan investor; yang tak berubah tidak di-update", async () => {
    const removed = await new PushTokenRepository().clearFcmTokensFromArrays(["mati"]);

    expect(removed).toBe(2);
    expect(db.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u-1" },
      data: { fcmTokens: { set: ["hidup"] } },
    });
    expect(investorQueries.findInvestorFcmTokenOwners).toHaveBeenCalledWith(["mati"]);
    expect(investorQueries.replaceInvestorFcmTokens).toHaveBeenCalledWith("i-1", []);
    expect(db.prismaMitra.mitra.update).not.toHaveBeenCalled();
  });

  it("daftar token kosong tidak menyentuh database", async () => {
    await expect(new PushTokenRepository().clearFcmTokensFromArrays([])).resolves.toBe(0);
    expect(db.prisma.user.findMany).not.toHaveBeenCalled();
  });
});
