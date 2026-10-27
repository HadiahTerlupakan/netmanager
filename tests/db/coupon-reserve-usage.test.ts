import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prismaAuth } from "@/lib/prisma";
import { CouponRepository } from "@/modules/coupons/repositories/CouponRepository";

/**
 * Kuota kupon dulu dicek saat verifikasi lalu dicatat belakangan, jadi dua
 * pembayaran bersamaan sama-sama lolos dari kuota terakhir. reserveUsage
 * menggabungkan cek dan kenaikan usedCount dalam satu UPDATE; hanya Postgres
 * sungguhan yang bisa membuktikan perbandingan kolom-ke-kolomnya.
 *
 * Dilewati tanpa `TEST_DATABASE_URL`; lihat ./scripts/setup-test-db.sh.
 */

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const PROFIL = "profil-uji-kupon";
const PAKET = "paket-uji-kupon";
const PELANGGAN = "pelanggan-uji-kupon";
const KUPON = "kupon-uji-reserve";

const repo = new CouponRepository(prismaAuth as never);

async function bersihkan() {
  await prismaAuth.couponUsage.deleteMany({ where: { couponId: KUPON } });
  await prismaAuth.coupon.deleteMany({ where: { id: KUPON } });
  await prismaAuth.pelanggan.deleteMany({ where: { id: PELANGGAN } });
  await prismaAuth.hargaPaket.deleteMany({ where: { id: PAKET } });
  await prismaAuth.profilePPP.deleteMany({ where: { id: PROFIL } });
}

async function buatKupon(quota: number, usedCount = 0) {
  await prismaAuth.coupon.create({
    data: {
      id: KUPON,
      code: "UJIRESERVE",
      discountType: "FIXED",
      discountValue: 10000,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2027-01-01"),
      quota,
      usedCount,
    },
  });
}

async function usedCount() {
  const kupon = await prismaAuth.coupon.findUnique({ where: { id: KUPON } });
  return kupon?.usedCount;
}

describeDb("CouponRepository.reserveUsage", () => {
  beforeEach(async () => {
    await bersihkan();
    const now = new Date();
    await prismaAuth.profilePPP.create({
      data: {
        id: PROFIL,
        name: PROFIL,
        localAddress: "10.0.0.1",
        remoteAddress: "pool",
        updatedAt: now,
      },
    });
    await prismaAuth.hargaPaket.create({
      data: {
        id: PAKET,
        name: PAKET,
        profilePPPId: PROFIL,
        harga: 100000,
        updatedAt: now,
      },
    });
    await prismaAuth.pelanggan.create({
      data: {
        id: PELANGGAN,
        idPelanggan: "99990001",
        nama: "Uji Kupon",
        username: "uji-kupon",
        password: "x",
        hargaPaketId: PAKET,
        tanggalAktif: now,
        jatuhTempo: now,
        updatedAt: now,
      },
    });
  });

  afterAll(bersihkan);

  it("dua permintaan bersamaan atas kuota terakhir: hanya satu yang lolos", async () => {
    await buatKupon(1);

    const hasil = await Promise.all([
      repo.reserveUsage(KUPON, PELANGGAN),
      repo.reserveUsage(KUPON, PELANGGAN),
    ]);

    expect(hasil.filter(Boolean)).toHaveLength(1);
    expect(await usedCount()).toBe(1);
    expect(
      await prismaAuth.couponUsage.count({ where: { couponId: KUPON } }),
    ).toBe(1);
  });

  it("kuota 0 berarti tanpa batas", async () => {
    await buatKupon(0, 5);

    expect(await repo.reserveUsage(KUPON, PELANGGAN)).toEqual(
      expect.any(String),
    );
    expect(await usedCount()).toBe(6);
  });

  it("releaseUsage mengembalikan kuota dan menghapus riwayatnya", async () => {
    await buatKupon(1);
    const usageId = await repo.reserveUsage(KUPON, PELANGGAN);

    await repo.releaseUsage(usageId!, KUPON);

    expect(await usedCount()).toBe(0);
    expect(await repo.reserveUsage(KUPON, PELANGGAN)).toEqual(
      expect.any(String),
    );
  });
});
