import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const model = () => ({ findMany: vi.fn(), update: vi.fn() });
  return { prisma: { user: model(), investor: model() }, prismaMitra: { mitra: model() } };
});

vi.mock("@/modules/database", () => db);

import { PushTokenRepository } from "@/modules/notification/repositories/PushTokenRepository";

describe("PushTokenRepository.clearFcmTokensFromArrays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.prisma.user.findMany.mockResolvedValue([{ id: "u-1", fcmTokens: ["mati", "hidup"] }]);
    db.prismaMitra.mitra.findMany.mockResolvedValue([{ id: "m-1", fcmTokens: ["hidup"] }]);
    db.prisma.investor.findMany.mockResolvedValue([{ id: "i-1", fcmTokens: ["mati"] }]);
  });

  it("melepas token mati dari user, mitra, dan investor; yang tak berubah tidak di-update", async () => {
    const removed = await new PushTokenRepository().clearFcmTokensFromArrays(["mati"]);

    expect(removed).toBe(2);
    expect(db.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u-1" },
      data: { fcmTokens: { set: ["hidup"] } },
    });
    expect(db.prisma.investor.update).toHaveBeenCalledWith({
      where: { id: "i-1" },
      data: { fcmTokens: { set: [] } },
    });
    expect(db.prismaMitra.mitra.update).not.toHaveBeenCalled();
  });

  it("daftar token kosong tidak menyentuh database", async () => {
    await expect(new PushTokenRepository().clearFcmTokensFromArrays([])).resolves.toBe(0);
    expect(db.prisma.user.findMany).not.toHaveBeenCalled();
  });
});
