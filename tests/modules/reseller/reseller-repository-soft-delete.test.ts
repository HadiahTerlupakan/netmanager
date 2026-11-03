import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ResellerRepository } from "@/modules/reseller/repositories/ResellerRepository";

function createDb(status: string) {
  const db = {
    reseller: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: "reseller-1", tenantId: "tenant-1", status }),
      update: vi.fn(async ({ data }) => ({
        id: "reseller-1",
        tenantId: "tenant-1",
        status: data.status,
      })),
    },
    resellerStatusHistory: { create: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ id: "reseller-1" }]),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  return db;
}

describe("ResellerRepository.softDelete", () => {
  it("mencatat waktu perubahan status agar komisi pembayaran sebelumnya tetap terakru", async () => {
    const db = createDb("ACTIVE");

    await new ResellerRepository(db as unknown as PrismaClient).softDelete(
      "tenant-1",
      "reseller-1",
    );

    const { data } = db.reseller.update.mock.calls[0][0];
    expect(data.status).toBe("INACTIVE");
    expect(data.statusChangedAt).toBeInstanceOf(Date);
    expect(data.statusChangedAt).toEqual(data.deletedAt);
  });

  it("menulis riwayat status dalam transaksi yang sama, atas nama pelaku", async () => {
    const db = createDb("SUSPENDED");

    await new ResellerRepository(db as unknown as PrismaClient).softDelete(
      "tenant-1",
      "reseller-1",
      "admin-1",
    );

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const { data } = db.resellerStatusHistory.create.mock.calls[0][0];
    expect(data).toMatchObject({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      fromStatus: "SUSPENDED",
      toStatus: "INACTIVE",
      reason: "Reseller dihapus",
      changedById: "admin-1",
    });
    expect(data.changedAt).toEqual(
      db.reseller.update.mock.calls[0][0].data.deletedAt,
    );
  });

  it("tidak menimpa waktu perubahan maupun menulis riwayat bila reseller sudah INACTIVE", async () => {
    const db = createDb("INACTIVE");

    await new ResellerRepository(db as unknown as PrismaClient).softDelete(
      "tenant-1",
      "reseller-1",
    );

    expect(db.reseller.update.mock.calls[0][0].data).not.toHaveProperty(
      "statusChangedAt",
    );
    expect(db.resellerStatusHistory.create).not.toHaveBeenCalled();
  });

  it("reseller tidak ditemukan di tenant: tidak mengubah apa pun", async () => {
    const db = createDb("ACTIVE");
    db.reseller.findFirst.mockResolvedValueOnce(null);

    await expect(
      new ResellerRepository(db as unknown as PrismaClient).softDelete(
        "tenant-1",
        "reseller-1",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.reseller.findFirst.mock.calls[0][0].where).toMatchObject({
      tenantId: "tenant-1",
      deletedAt: null,
    });
    expect(db.reseller.update).not.toHaveBeenCalled();
    expect(db.resellerStatusHistory.create).not.toHaveBeenCalled();
  });
  it("mengunci baris reseller sebelum membaca status lama", async () => {
    const db = createDb("ACTIVE");

    await new ResellerRepository(db as unknown as PrismaClient).softDelete(
      "tenant-1",
      "reseller-1",
    );

    const [sql] = db.$queryRaw.mock.calls[0];
    expect(sql.join("?")).toContain("FOR UPDATE");
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.reseller.findFirst.mock.invocationCallOrder[0],
    );
  });
});

describe("ResellerRepository.update", () => {
  it("mencatat status lama dari baris yang dikunci", async () => {
    const db = createDb("SUSPENDED");

    await new ResellerRepository(db as unknown as PrismaClient).update(
      "tenant-1",
      "reseller-1",
      {
        status: "TERMINATED",
        statusReason: "Kontrak diputus",
        statusChangedAt: new Date("2026-11-03T00:00:00.000Z"),
        statusChangedById: "admin-2",
      },
    );

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const { data } = db.resellerStatusHistory.create.mock.calls[0][0];
    expect(data).toMatchObject({
      fromStatus: "SUSPENDED",
      toStatus: "TERMINATED",
      changedById: "admin-2",
    });
  });

  it("perubahan ke status yang sudah berlaku tidak menggeser waktu perubahan dan tidak menulis riwayat", async () => {
    // Dua PUT SUSPENDED berlomba: yang kedua mendapati status sudah SUSPENDED.
    const db = createDb("SUSPENDED");

    await new ResellerRepository(db as unknown as PrismaClient).update(
      "tenant-1",
      "reseller-1",
      {
        status: "SUSPENDED",
        statusReason: "Tunggakan setoran",
        statusChangedAt: new Date("2026-11-03T00:00:00.000Z"),
        statusChangedById: "admin-2",
      },
    );

    const { data } = db.reseller.update.mock.calls[0][0];
    expect(data).not.toHaveProperty("statusChangedAt");
    expect(data).not.toHaveProperty("statusChangedById");
    expect(data).toMatchObject({ status: "SUSPENDED" });
    expect(db.resellerStatusHistory.create).not.toHaveBeenCalled();
  });
});
