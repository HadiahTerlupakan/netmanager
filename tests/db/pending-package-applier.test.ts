import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaAuth } from "@/lib/prisma";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { InvoiceProrateService } from "@/modules/finance/services/InvoiceProrateService";
import { PendingPackageApplierService } from "@/modules/finance/services/PendingPackageApplierService";

/**
 * Perubahan paket terjadwal (NEXT_CYCLE) diterapkan cron harian 00:05 WIB
 * (`lib/cron-registry.ts`, TZ kontainer Asia/Jakarta) dan belum pernah
 * dibuktikan terhadap Postgres sungguhan. Yang dibuktikan di sini:
 *
 *   1. Menjadwalkan upgrade lewat jalur admin yang asli (paket ditulis, lalu
 *      `InvoiceProrateService` mengembalikannya dan mengisi field pending)
 *      menyimpan `pendingPackageApplyAt` sama dengan jatuh tempo, yang
 *      ekstensi Prisma bulatkan ke 00:00 WIB.
 *   2. Cron malam sebelum jatuh tempo tidak menerapkannya.
 *   3. Cron 00:05 WIB pada tanggal jatuh tempo menerapkannya: paket berganti,
 *      semua field pending kosong, dan PACKAGE_CHANGED (yang menyinkronkan
 *      profil RADIUS/MikroTik) diterbitkan sekali dengan paket lama → baru.
 *   4. Cron malam berikutnya tidak menerapkannya lagi.
 *
 * Event bus di-mock: yang diuji adalah apa yang diterbitkan, bukan antrean.
 * Dilewati tanpa `TEST_DATABASE_URL` (lihat ./scripts/setup-test-db.sh).
 */

const onPackageChanged = vi.hoisted(() =>
  vi.fn(async (_payload: { customerId: string }) => undefined),
);
vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: { onPackageChanged },
}));

const adaDbUji = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = adaDbUji ? describe : describe.skip;

const TENANT = "tenant-uji-paket-terjadwal";
const PELANGGAN = "pel-uji-paket-terjadwal";
const PAKET_LAMA = "paket-uji-terjadwal-10m";
const PAKET_BARU = "paket-uji-terjadwal-20m";
const PROFIL_LAMA = "profil-uji-terjadwal-10m";
const PROFIL_BARU = "profil-uji-terjadwal-20m";

// Jatuh tempo 1 Nov 2026 = 00:00 WIB = 31 Okt 17:00 UTC.
const JATUH_TEMPO_WIB = new Date("2026-10-31T17:00:00.000Z");
const CRON_31_OKT = new Date("2026-10-30T17:05:00.000Z");
const CRON_1_NOV = new Date("2026-10-31T17:05:00.000Z");
const CRON_2_NOV = new Date("2026-11-01T17:05:00.000Z");

async function bersihkan() {
  await prismaAuth.proratePaymentLog.deleteMany({
    where: { pelangganId: PELANGGAN },
  });
  await prismaAuth.pelanggan.deleteMany({ where: { id: PELANGGAN } });
  await prismaAuth.hargaPaket.deleteMany({
    where: { id: { in: [PAKET_LAMA, PAKET_BARU] } },
  });
  await prismaAuth.profilePPP.deleteMany({
    where: { id: { in: [PROFIL_LAMA, PROFIL_BARU] } },
  });
}

async function siapkanData() {
  await prismaAuth.tenant.upsert({
    where: { id: TENANT },
    update: {},
    create: { id: TENANT, name: TENANT },
  });
  for (const [profil, paket, harga] of [
    [PROFIL_LAMA, PAKET_LAMA, 150000],
    [PROFIL_BARU, PAKET_BARU, 250000],
  ] as const) {
    await prismaAuth.profilePPP.create({
      data: {
        id: profil,
        name: profil,
        localAddress: "10.0.0.1",
        remoteAddress: "pool-uji",
        tenantId: TENANT,
        updatedAt: new Date(),
      },
    });
    await prismaAuth.hargaPaket.create({
      data: {
        id: paket,
        name: paket,
        profilePPPId: profil,
        harga,
        tenantId: TENANT,
        updatedAt: new Date(),
      },
    });
  }
  await prismaAuth.pelanggan.create({
    data: {
      id: PELANGGAN,
      idPelanggan: "99990001",
      nama: "Pelanggan Uji Terjadwal",
      username: "uji-paket-terjadwal",
      password: "pppoe-uji",
      hargaPaketId: PAKET_LAMA,
      tanggalAktif: new Date("2026-10-01T00:00:00+07:00"),
      jatuhTempo: new Date("2026-11-01T09:30:00+07:00"),
      status: "AKTIF",
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
}

/** Seperti admin menyimpan form edit dengan "Terapkan di siklus berikutnya". */
async function jadwalkanUpgrade() {
  await runWithRequestTenantContext(
    { tenantId: TENANT, isSuperAdmin: false },
    async () => {
      await prismaAuth.pelanggan.update({
        where: { id: PELANGGAN },
        data: { hargaPaketId: PAKET_BARU },
      });
      await new InvoiceProrateService().applyPackageChange({
        pelangganId: PELANGGAN,
        oldHargaPaketId: PAKET_LAMA,
        newHargaPaketId: PAKET_BARU,
        prorateOption: "NONE",
        downgradeAdjustment: "NONE",
        upgradeApplyTime: "NEXT_CYCLE",
      });
    },
  );
}

/** Seperti `runCronTask("applyPendingPackages", ...)` di cron-registry. */
function jalankanCron(pada: Date) {
  return runAsSystemContext("test:applyPendingPackages", () =>
    new PendingPackageApplierService().applyDuePending(pada),
  );
}

function bacaPelanggan() {
  return prismaAuth.pelanggan.findUniqueOrThrow({
    where: { id: PELANGGAN },
    select: {
      hargaPaketId: true,
      jatuhTempo: true,
      pendingPackageId: true,
      pendingPackageApplyAt: true,
      pendingPackageByCustomer: true,
    },
  });
}

function eventUntukPelangganIni() {
  return onPackageChanged.mock.calls.filter(
    ([payload]) => payload.customerId === PELANGGAN,
  );
}

describeDb("cron paket terjadwal (NEXT_CYCLE)", () => {
  beforeEach(async () => {
    onPackageChanged.mockClear();
    await bersihkan();
    await siapkanData();
  });

  afterAll(async () => {
    await bersihkan();
  });

  it("menjadwalkan upgrade pada jatuh tempo tanpa mengganti paket sekarang", async () => {
    await jadwalkanUpgrade();

    const pelanggan = await bacaPelanggan();
    expect(pelanggan.jatuhTempo).toEqual(JATUH_TEMPO_WIB);
    expect(pelanggan).toMatchObject({
      hargaPaketId: PAKET_LAMA,
      pendingPackageId: PAKET_BARU,
      pendingPackageApplyAt: JATUH_TEMPO_WIB,
    });
    expect(eventUntukPelangganIni()).toHaveLength(0);
  });

  it("tidak diterapkan oleh cron malam sebelum jatuh tempo", async () => {
    await jadwalkanUpgrade();

    await jalankanCron(CRON_31_OKT);

    expect(await bacaPelanggan()).toMatchObject({
      hargaPaketId: PAKET_LAMA,
      pendingPackageId: PAKET_BARU,
    });
    expect(eventUntukPelangganIni()).toHaveLength(0);
  });

  it("diterapkan cron 00:05 WIB pada jatuh tempo lalu dikosongkan", async () => {
    await jadwalkanUpgrade();

    await jalankanCron(CRON_1_NOV);

    expect(await bacaPelanggan()).toEqual({
      hargaPaketId: PAKET_BARU,
      jatuhTempo: JATUH_TEMPO_WIB,
      pendingPackageId: null,
      pendingPackageApplyAt: null,
      pendingPackageByCustomer: false,
    });
    expect(eventUntukPelangganIni()).toEqual([
      [
        expect.objectContaining({
          oldPackageId: PAKET_LAMA,
          newPackageId: PAKET_BARU,
          oldProfileName: PROFIL_LAMA,
          newProfileName: PROFIL_BARU,
          oldPackagePrice: 150000,
          newPackagePrice: 250000,
          applyTime: "IMMEDIATE",
          tenantId: TENANT,
        }),
      ],
    ]);
  });

  it("tidak diterapkan ulang oleh cron malam berikutnya", async () => {
    await jadwalkanUpgrade();
    await jalankanCron(CRON_1_NOV);
    onPackageChanged.mockClear();

    await jalankanCron(CRON_2_NOV);

    expect((await bacaPelanggan()).hargaPaketId).toBe(PAKET_BARU);
    expect(eventUntukPelangganIni()).toHaveLength(0);
  });
});
