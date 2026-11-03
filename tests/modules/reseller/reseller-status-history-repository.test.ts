import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ResellerRepository } from "@/modules/reseller/repositories/ResellerRepository";
import { ResellerStatusHistoryRepository } from "@/modules/reseller/repositories/ResellerStatusHistoryRepository";

const CHANGED_AT = new Date("2026-11-03T02:00:00.000Z");

function createDb(existingStatus = "ACTIVE") {
  const db = {
    reseller: {
      findFirst: vi.fn().mockResolvedValue({
        id: "reseller-1",
        tenantId: "tenant-1",
        status: existingStatus,
      }),
      create: vi.fn(async ({ data }) => ({
        ...data,
        status: data.status ?? "ACTIVE",
      })),
      update: vi.fn(async ({ data }) => ({
        id: "reseller-1",
        tenantId: "tenant-1",
        status: data.status ?? existingStatus,
      })),
    },
    resellerStatusHistory: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    // Row lock (SELECT ... FOR UPDATE) sebelum status lama dibaca.
    $queryRaw: vi.fn().mockResolvedValue([{ id: "reseller-1" }]),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  return db;
}

const repositoryOf = (db: ReturnType<typeof createDb>) =>
  new ResellerRepository(db as unknown as PrismaClient);

describe("ResellerRepository — riwayat status saat create", () => {
  it("status awal selain ACTIVE dicatat sebagai perubahan dari null", async () => {
    const db = createDb();

    await repositoryOf(db).create({
      tenantId: "tenant-1",
      code: "R1",
      name: "Reseller Satu",
      status: "SUSPENDED",
      statusReason: "Menunggu PKS",
      statusChangedAt: CHANGED_AT,
      statusChangedById: "admin-1",
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.resellerStatusHistory.create.mock.calls[0][0].data).toMatchObject(
      {
        tenantId: "tenant-1",
        fromStatus: null,
        toStatus: "SUSPENDED",
        reason: "Menunggu PKS",
        changedById: "admin-1",
        changedAt: CHANGED_AT,
      },
    );
  });

  it("reseller baru berstatus ACTIVE tidak menulis riwayat", async () => {
    const db = createDb();

    await repositoryOf(db).create({
      tenantId: "tenant-1",
      code: "R1",
      name: "Reseller Satu",
      status: "ACTIVE",
    });

    expect(db.resellerStatusHistory.create).not.toHaveBeenCalled();
  });
});

describe("ResellerRepository — riwayat status saat update", () => {
  it("perubahan status menulis riwayat dari status lama dalam transaksi", async () => {
    const db = createDb("ACTIVE");

    await repositoryOf(db).update("tenant-1", "reseller-1", {
      status: "TERMINATED",
      statusReason: "PKS diputus",
      statusChangedAt: CHANGED_AT,
      statusChangedById: "admin-2",
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.reseller.findFirst.mock.calls[0][0].where).toMatchObject({
      id: "reseller-1",
      tenantId: "tenant-1",
      deletedAt: null,
    });
    expect(db.resellerStatusHistory.create.mock.calls[0][0].data).toMatchObject(
      {
        resellerId: "reseller-1",
        fromStatus: "ACTIVE",
        toStatus: "TERMINATED",
        reason: "PKS diputus",
        changedById: "admin-2",
        changedAt: CHANGED_AT,
      },
    );
  });

  it("update tanpa perubahan status tidak menulis riwayat", async () => {
    const db = createDb("ACTIVE");

    await repositoryOf(db).update("tenant-1", "reseller-1", {
      name: "Nama Baru",
      statusReason: "catatan",
    });

    expect(db.resellerStatusHistory.create).not.toHaveBeenCalled();
  });

  it("reseller tenant lain ditolak 404 tanpa menulis apa pun", async () => {
    const db = createDb();
    db.reseller.findFirst.mockResolvedValueOnce(null);

    await expect(
      repositoryOf(db).update("tenant-2", "reseller-1", {
        status: "SUSPENDED",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.reseller.update).not.toHaveBeenCalled();
    expect(db.resellerStatusHistory.create).not.toHaveBeenCalled();
  });
});

describe("ResellerStatusHistoryRepository.findByResellerId", () => {
  it("menyaring tenant & reseller, terbaru lebih dulu, dengan paginasi", async () => {
    const db = createDb();
    const row = {
      id: "h1",
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      fromStatus: "ACTIVE",
      toStatus: "SUSPENDED",
      reason: "x",
      changedById: null as string | null,
      changedAt: CHANGED_AT,
    };
    db.resellerStatusHistory.findMany.mockResolvedValueOnce([row]);
    db.resellerStatusHistory.count.mockResolvedValueOnce(11);

    const result = await new ResellerStatusHistoryRepository(
      db as unknown as PrismaClient,
    ).findByResellerId({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      skip: 10,
      take: 10,
    });

    expect(result).toEqual({ items: [row], total: 11 });
    const where = { tenantId: "tenant-1", resellerId: "reseller-1" };
    expect(db.resellerStatusHistory.findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ changedAt: "desc" }, { id: "desc" }],
      skip: 10,
      take: 10,
    });
    expect(db.resellerStatusHistory.count).toHaveBeenCalledWith({ where });
  });
});
