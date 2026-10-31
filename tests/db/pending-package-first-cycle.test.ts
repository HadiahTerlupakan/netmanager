import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { prismaAuth } from "@/lib/prisma";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { AutomaticBillingService } from "@/modules/finance/services/AutomaticBillingService";
import { InvoiceProrateService } from "@/modules/finance/services/InvoiceProrateService";
import { getCustomerPackageUpgradeService } from "@/modules/pelanggan/services/CustomerPackageUpgradeService";

/**
 * Tagihan siklus terbit ±5 hari sebelum jatuh tempo (billing harian), tetapi
 * paket terjadwal (NEXT_CYCLE) baru diganti cron pada jatuh tempo itu. Dulu
 * siklus pertama paket baru ditagih dengan harga paket lama. Dibuktikan di sini
 * terhadap Postgres sungguhan (database utama + billing):
 *
 *   1. Tagihan yang terbit setelah perubahan dijadwalkan memakai paket baru.
 *   2. Perubahan yang diajukan setelah tagihannya terbit mengganti tagihan yang
 *      belum dibayar, dan billing harian tidak menerbitkan tagihan ketiga.
 *   3. Membatalkan pengajuan mengembalikan tagihan ke paket sekarang.
 *   4. Tagihan dengan checkout VA yang masih berlaku dibiarkan utuh.
 *   5. Turun paket: saldo kredit yang terpakai tagihan lama dikembalikan lalu
 *      dipakai lagi sesuai nominal baru.
 *
 * Event bus, antrean schedule, kunci Redis, dan notifikasi di-mock: yang diuji
 * adalah tagihan yang tersimpan. Dilewati tanpa TEST_DATABASE_URL dan
 * TEST_DATABASE_URL_BILLING (lihat ./scripts/setup-test-db.sh).
 */

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: { onPackageChanged: vi.fn(async () => undefined) },
}));
vi.mock("@/lib/event-bus", () => ({
  eventBus: { publish: vi.fn(async () => undefined) },
  EVENT_NAMES: { INVOICE_CREATED: "billing:invoice.created" },
}));
vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  syncInvoiceBillingSchedules: vi.fn(async () => undefined),
  cancelInvoiceBillingSchedules: vi.fn(async () => undefined),
}));
vi.mock("@/lib/distributed-lock", () => ({
  acquireLock: vi.fn(
    async (): Promise<() => Promise<void>> => async () => undefined,
  ),
}));
vi.mock("@/modules/notification", () => ({
  notifyPackageUpgradeRequested: vi.fn(async () => undefined),
  notifyPackageUpgradeCancelled: vi.fn(async () => undefined),
}));

const adaDbUji = Boolean(
  process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL_BILLING,
);
const describeDb = adaDbUji ? describe : describe.skip;

const TENANT = "tenant-uji-siklus-pertama";
const PELANGGAN = "pel-uji-siklus-pertama";
const PAKET_LAMA = "paket-uji-siklus-10m";
const PAKET_BARU = "paket-uji-siklus-20m";
const PROFIL_LAMA = "profil-uji-siklus-10m";
const PROFIL_BARU = "profil-uji-siklus-20m";

// Harga + PPN 11% paket.
const TOTAL_LAMA = 166500n; // 150.000 + 16.500
const TOTAL_BARU = 277500n; // 250.000 + 27.500

// Jatuh tempo 1 Nov 2026 = 00:00 WIB; billing harian 28 Okt 10:00 WIB.
const JATUH_TEMPO_WIB = new Date("2026-10-31T17:00:00.000Z");
const HARI_BILLING = new Date("2026-10-28T03:00:00.000Z");

async function bersihkan() {
  await prismaBillingAuth.payment.deleteMany({
    where: { pelangganId: PELANGGAN },
  });
  await prismaBillingAuth.invoice.deleteMany({
    where: { pelangganId: PELANGGAN },
  });
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

async function siapkanData(opsi: { paket?: string; saldo?: bigint } = {}) {
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
        usePPN: true,
        ppnPercentage: 11,
        tenantId: TENANT,
        updatedAt: new Date(),
      },
    });
  }
  await prismaAuth.pelanggan.create({
    data: {
      id: PELANGGAN,
      idPelanggan: "99990002",
      nama: "Pelanggan Uji Siklus Pertama",
      username: "uji-siklus-pertama",
      password: "pppoe-uji",
      hargaPaketId: opsi.paket ?? PAKET_LAMA,
      tanggalAktif: new Date("2026-10-01T00:00:00+07:00"),
      jatuhTempo: JATUH_TEMPO_WIB,
      status: "AKTIF",
      saldoKreditRupiah: opsi.saldo ?? 0n,
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
}

function sebagaiTenant<T>(task: () => Promise<T>) {
  return runWithRequestTenantContext(
    { tenantId: TENANT, isSuperAdmin: false },
    task,
  );
}

/** Seperti cron `generateDailyInvoices`. */
function jalankanBillingHarian() {
  return runAsSystemContext("test:generateDailyInvoices", () =>
    AutomaticBillingService.generateDailyInvoices(),
  );
}

/** Seperti admin menyimpan form edit dengan "Terapkan di siklus berikutnya". */
function jadwalkanOlehPetugas(dari: string, ke: string) {
  return sebagaiTenant(async () => {
    await prismaAuth.pelanggan.update({
      where: { id: PELANGGAN },
      data: { hargaPaketId: ke },
    });
    return new InvoiceProrateService().applyPackageChange({
      pelangganId: PELANGGAN,
      oldHargaPaketId: dari,
      newHargaPaketId: ke,
      prorateOption: "NONE",
      downgradeAdjustment: "NONE",
      upgradeApplyTime: "NEXT_CYCLE",
    });
  });
}

function ajukanUpgrade() {
  return sebagaiTenant(() =>
    getCustomerPackageUpgradeService().requestUpgrade(PELANGGAN, PAKET_BARU),
  );
}

function batalkanPengajuan() {
  return sebagaiTenant(() =>
    getCustomerPackageUpgradeService().cancelUpgrade(PELANGGAN),
  );
}

function bacaTagihan() {
  return prismaBillingAuth.invoice.findMany({
    where: { pelangganId: PELANGGAN },
    include: { invoiceItem: true },
    orderBy: { createdAt: "asc" },
  });
}

async function tagihanHidup() {
  const semua = await bacaTagihan();
  return semua.filter((invoice) => invoice.status !== "CANCELLED");
}

describeDb("tagihan siklus pertama paket terjadwal", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(HARI_BILLING);
    await bersihkan();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await bersihkan();
  });

  it("tagihan yang terbit setelah upgrade dijadwalkan ditagih dengan paket baru", async () => {
    await siapkanData();
    await jadwalkanOlehPetugas(PAKET_LAMA, PAKET_BARU);

    await jalankanBillingHarian();

    const [tagihan, ...lainnya] = await tagihanHidup();
    expect(lainnya).toHaveLength(0);
    expect(tagihan).toMatchObject({
      status: "SENT",
      dueDate: JATUH_TEMPO_WIB,
      subtotal: 250000n,
      taxAmount: 27500n,
      totalAmount: TOTAL_BARU,
    });
    expect(tagihan.invoiceItem.map((item) => item.description)).toEqual([
      `Berlangganan Internet Paket ${PAKET_BARU}`,
    ]);
  });

  it("upgrade yang diajukan setelah tagihan terbit mengganti tagihan yang belum dibayar", async () => {
    await siapkanData();
    await jalankanBillingHarian();
    const [tagihanLama] = await tagihanHidup();
    expect(tagihanLama.totalAmount).toBe(TOTAL_LAMA);

    const hasil = await ajukanUpgrade();
    await jalankanBillingHarian();

    const semua = await bacaTagihan();
    const hidup = semua.filter((invoice) => invoice.status !== "CANCELLED");
    expect(semua.find((i) => i.id === tagihanLama.id)?.status).toBe(
      "CANCELLED",
    );
    expect(hidup).toHaveLength(1);
    expect(hidup[0]).toMatchObject({
      status: "SENT",
      dueDate: JATUH_TEMPO_WIB,
      totalAmount: TOTAL_BARU,
    });
    expect(hasil.cycleInvoice).toEqual({
      status: "REISSUED",
      invoiceId: hidup[0].id,
      dueDate: JATUH_TEMPO_WIB,
      totalAmount: Number(TOTAL_BARU),
    });
  });

  it("membatalkan pengajuan mengembalikan tagihan ke harga paket sekarang", async () => {
    await siapkanData();
    await jalankanBillingHarian();
    await ajukanUpgrade();

    await batalkanPengajuan();

    // Tagihan awal dan tagihan paket baru sama-sama dibatalkan.
    expect(await bacaTagihan()).toHaveLength(3);
    const hidup = await tagihanHidup();
    expect(hidup).toHaveLength(1);
    expect(hidup[0]).toMatchObject({
      dueDate: JATUH_TEMPO_WIB,
      subtotal: 150000n,
      totalAmount: TOTAL_LAMA,
    });
    expect(hidup[0].invoiceItem[0].description).toBe(
      `Berlangganan Internet Paket ${PAKET_LAMA}`,
    );
  });

  it("tagihan dengan checkout VA yang masih berlaku dibiarkan utuh", async () => {
    await siapkanData();
    await jalankanBillingHarian();
    const [tagihan] = await tagihanHidup();
    await prismaBillingAuth.payment.create({
      data: {
        id: "pay-uji-siklus-va",
        invoiceId: tagihan.id,
        pelangganId: PELANGGAN,
        amount: TOTAL_LAMA,
        paymentDate: HARI_BILLING,
        paymentMethod: "OTHER",
        gatewayStatus: "PENDING",
        gatewayProvider: "BC",
        reference: "uji-siklus-va",
        expiresAt: new Date(HARI_BILLING.getTime() + 24 * 60 * 60 * 1000),
        tenantId: TENANT,
        updatedAt: HARI_BILLING,
      },
    });

    const hasil = await ajukanUpgrade();

    const semua = await bacaTagihan();
    expect(semua).toHaveLength(1);
    expect(semua[0]).toMatchObject({
      id: tagihan.id,
      status: "SENT",
      totalAmount: TOTAL_LAMA,
    });
    expect(hasil.cycleInvoice).toMatchObject({
      status: "KEPT",
      invoiceId: tagihan.id,
      totalAmount: Number(TOTAL_LAMA),
    });
  });

  it("turun paket memakai ulang saldo kredit sesuai nominal tagihan baru", async () => {
    await siapkanData({ paket: PAKET_BARU, saldo: 200000n });
    await jalankanBillingHarian();
    const [tagihanLama] = await tagihanHidup();
    expect(tagihanLama).toMatchObject({
      discountAmount: 200000n,
      totalAmount: TOTAL_BARU - 200000n,
    });

    await jadwalkanOlehPetugas(PAKET_BARU, PAKET_LAMA);

    const hidup = await tagihanHidup();
    expect(hidup).toHaveLength(1);
    expect(hidup[0]).toMatchObject({
      subtotal: 150000n,
      taxAmount: 16500n,
      discountAmount: TOTAL_LAMA,
      totalAmount: 0n,
    });
    const pelanggan = await prismaAuth.pelanggan.findUniqueOrThrow({
      where: { id: PELANGGAN },
      select: { saldoKreditRupiah: true },
    });
    expect(pelanggan.saldoKreditRupiah).toBe(200000n - TOTAL_LAMA);
  });
});
