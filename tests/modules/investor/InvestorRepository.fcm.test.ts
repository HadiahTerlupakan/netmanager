import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { InvestorRepository } from "@/modules/investor/repositories/InvestorRepository";

const tx = {
  investor: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $queryRaw: vi.fn(),
};

/** Tabel yang dilepas dari token, menurut SQL mentah yang dijalankan. */
function tabelDilepas(
  queryRaw: { mock: { calls: unknown[][] } },
  token: string,
) {
  return queryRaw.mock.calls
    .filter(([, ...nilai]) => nilai.includes(token))
    .map(([sql]) => /UPDATE "(\w+)"/.exec((sql as string[]).join(""))?.[1]);
}
const client = {
  ...tx,
  $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
};
const repo = new InvestorRepository(client as never);

describe("InvestorRepository — token FCM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Klaim token melepasnya dari pemilik lain; di sini tidak ada pemilik lain.
    tx.$queryRaw.mockResolvedValue([]);
    prismaMock.$queryRaw.mockResolvedValue([]);
  });

  it("token baru ditambahkan di akhir, maksimal 5 terbaru, dan dilepas dari pemilik lain", async () => {
    tx.investor.findUnique.mockResolvedValue({
      fcmTokens: ["t1", "t2", "t3", "t4", "t5"],
    });

    await expect(repo.addFcmToken("inv-1", "baru")).resolves.toBe(true);

    expect(tx.investor.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: {
        fcmTokens: { set: ["t2", "t3", "t4", "t5", "baru"] },
        pushTokenUpdatedAt: expect.any(Date),
      },
    });
    // Database utama di transaksi pendaftaran, database mitra sesudahnya.
    expect(tabelDilepas(tx.$queryRaw, "baru")).toEqual([
      "User",
      "Pelanggan",
      "Investor",
    ]);
    expect(tabelDilepas(prismaMock.$queryRaw, "baru")).toEqual(["Mitra"]);
  });

  it("token yang sudah ada tidak digandakan; investor tidak ada → false tanpa melepas apa pun", async () => {
    tx.investor.findUnique.mockResolvedValueOnce({ fcmTokens: ["a", "b"] });
    await repo.addFcmToken("inv-1", "a");
    expect(tx.investor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fcmTokens: { set: ["b", "a"] } }),
      }),
    );

    tx.$queryRaw.mockClear();
    prismaMock.$queryRaw.mockClear();
    tx.investor.findUnique.mockResolvedValueOnce(null);
    await expect(repo.addFcmToken("tidak-ada", "a")).resolves.toBe(false);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("investor nonaktif tidak menerima push", async () => {
    client.investor.findFirst.mockResolvedValueOnce({
      fcmTokens: ["a"],
      isActive: false,
    });
    await expect(repo.findFcmTokens("inv-1", "tenant-1")).resolves.toEqual([]);
  });

  it("token hanya diambil dari investor di tenant asal event", async () => {
    client.investor.findFirst.mockResolvedValueOnce(null);
    await expect(repo.findFcmTokens("inv-1", "tenant-lain")).resolves.toEqual(
      [],
    );
    expect(client.investor.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1", tenantId: "tenant-lain" },
      }),
    );
  });
});
