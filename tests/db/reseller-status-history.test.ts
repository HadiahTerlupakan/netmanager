import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prismaAuth } from "@/lib/prisma";
import { ResellerRepository } from "@/modules/reseller/repositories/ResellerRepository";
import { ResellerStatusHistoryRepository } from "@/modules/reseller/repositories/ResellerStatusHistoryRepository";

/**
 * Riwayat status kemitraan ditulis dalam transaksi yang sama dengan perubahan
 * status: create (status awal non-ACTIVE), update, dan soft delete. Hanya bisa
 * dibuktikan Postgres (FK, enum, transaksi interaktif).
 *
 * Dilewati tanpa `TEST_DATABASE_URL`; lihat ./scripts/setup-test-db.sh.
 */

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const TENANT = "tenant-uji-riwayat-status";
const OTHER_TENANT = "tenant-uji-riwayat-status-lain";
const CODE = "RSL-UJI-RIWAYAT";

const resellers = new ResellerRepository(prismaAuth as never);
const history = new ResellerStatusHistoryRepository(prismaAuth as never);

async function bersihkan() {
  const tenantIds = [TENANT, OTHER_TENANT];
  await prismaAuth.resellerStatusHistory.deleteMany({
    where: { tenantId: { in: tenantIds } },
  });
  await prismaAuth.reseller.deleteMany({
    where: { tenantId: { in: tenantIds } },
  });
  await prismaAuth.tenant.deleteMany({ where: { id: { in: tenantIds } } });
}

describeDb("ResellerStatusHistory — Postgres", () => {
  beforeEach(async () => {
    await bersihkan();
    await prismaAuth.tenant.createMany({
      data: [
        { id: TENANT, name: "Tenant Uji Riwayat" },
        { id: OTHER_TENANT, name: "Tenant Uji Riwayat Lain" },
      ],
    });
  });

  afterAll(async () => {
    await bersihkan();
  });

  it("mencatat create, update, dan soft delete berurutan", async () => {
    const created = await resellers.create({
      tenantId: TENANT,
      code: CODE,
      name: "Reseller Uji Riwayat",
      status: "SUSPENDED",
      statusReason: "Menunggu PKS",
      statusChangedAt: new Date("2026-11-01T00:00:00.000Z"),
      statusChangedById: "admin-1",
    });
    await resellers.update(TENANT, created.id, {
      status: "ACTIVE",
      statusReason: "PKS ditandatangani",
      statusChangedAt: new Date("2026-11-02T00:00:00.000Z"),
      statusChangedById: "admin-2",
    });
    await resellers.update(TENANT, created.id, { name: "Nama Baru" });
    await resellers.softDelete(TENANT, created.id, "admin-3");

    const result = await history.findByResellerId({
      tenantId: TENANT,
      resellerId: created.id,
      skip: 0,
      take: 10,
    });

    expect(result.total).toBe(3);
    expect(
      result.items.map(({ fromStatus, toStatus, reason, changedById }) => ({
        fromStatus,
        toStatus,
        reason,
        changedById,
      })),
    ).toEqual([
      {
        fromStatus: "ACTIVE",
        toStatus: "INACTIVE",
        reason: "Reseller dihapus",
        changedById: "admin-3",
      },
      {
        fromStatus: "SUSPENDED",
        toStatus: "ACTIVE",
        reason: "PKS ditandatangani",
        changedById: "admin-2",
      },
      {
        fromStatus: null,
        toStatus: "SUSPENDED",
        reason: "Menunggu PKS",
        changedById: "admin-1",
      },
    ]);
  });

  it("riwayat tidak terbaca dari tenant lain", async () => {
    const created = await resellers.create({
      tenantId: TENANT,
      code: CODE,
      name: "Reseller Uji Riwayat",
      status: "TERMINATED",
      statusReason: "Uji",
    });

    const result = await history.findByResellerId({
      tenantId: OTHER_TENANT,
      resellerId: created.id,
      skip: 0,
      take: 10,
    });

    expect(result).toEqual({ items: [], total: 0 });
  });
  // Baris reseller dikunci sebelum status lama dibaca: perubahan yang berlomba
  // membentuk rantai riwayat yang utuh, dan permintaan ganda ke status yang
  // sama hanya tercatat sekali.
  it("perubahan status yang berlomba membentuk rantai riwayat yang konsisten", async () => {
    const created = await resellers.create({
      tenantId: TENANT,
      code: CODE,
      name: "Reseller Uji Riwayat",
    });
    const change = (status: "SUSPENDED" | "TERMINATED", actor: string) =>
      resellers.update(TENANT, created.id, {
        status,
        statusReason: `Uji ${status}`,
        statusChangedAt: new Date(),
        statusChangedById: actor,
      });

    await Promise.all([
      change("SUSPENDED", "admin-a"),
      change("SUSPENDED", "admin-b"),
      change("TERMINATED", "admin-c"),
    ]);

    const { items } = await history.findByResellerId({
      tenantId: TENANT,
      resellerId: created.id,
      skip: 0,
      take: 10,
    });
    // changedAt diisi saat permintaan dibuat, bukan saat commit; rantai
    // disusun dengan menelusuri fromStatus → toStatus dari status awal.
    const remaining = [...items];
    let status: string = "ACTIVE";
    while (remaining.length > 0) {
      const nextIndex = remaining.findIndex(
        (entry) => entry.fromStatus === status,
      );
      expect(nextIndex).toBeGreaterThanOrEqual(0);
      const [next] = remaining.splice(nextIndex, 1);
      expect(next.toStatus).not.toBe(next.fromStatus);
      status = next.toStatus;
    }
    const current = await prismaAuth.reseller.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(status).toBe(current.status);
  });
});
