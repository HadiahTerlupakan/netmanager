import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createHash } from "node:crypto";

import { logger } from "@/lib/logger";
import { prismaAuth } from "@/lib/prisma";
import { prismaMitraAuth } from "@/lib/prisma-mitra";
import { runWithRequestTenantContext } from "@/lib/tenant-context";
import { InvestorPushService } from "@/modules/investor/services/InvestorPushService";
import { sendCustomerPushNotification } from "@/modules/notification/services/CustomerPushService";
import { updateMobileFcmToken } from "@/modules/notification/services/MobileFcmTokenService";
import { deliverNotification } from "@/modules/notification/services/NotificationService.delivery";
import { UserLookupService } from "@/modules/users";

/**
 * Token FCM menandai satu pemasangan aplikasi. Perangkat yang berpindah tangan
 * — staf yang keluar paksa tanpa melepas token, pelanggan A lalu pelanggan B,
 * pelanggan lalu mitra — mendaftarkan token yang sama untuk pemilik baru,
 * sementara pemilik lama masih memegangnya: push pemilik lama sampai ke orang
 * yang sekarang memegang perangkat itu.
 *
 * Dibuktikan terhadap Postgres sungguhan (database utama dan database mitra):
 * pendaftaran memindahkan token dari setiap pemilik lain, dan push untuk
 * pemilik lama tidak lagi dikirim ke token itu. FCM dan Expo di-mock; tidak ada
 * push sungguhan. Dilewati tanpa `TEST_DATABASE_URL` dan
 * `TEST_DATABASE_URL_MITRA` (lihat ./scripts/setup-test-db.sh).
 */

const sendEachForMulticast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/firebase/admin", () => ({
  messaging: { sendEachForMulticast },
}));
// Push staf juga dikirim lewat realtime; yang diuji di sini hanya token FCM-nya.
vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: {
    notifyUser: vi.fn(),
    notifyDepartment: vi.fn(),
    notifyAdmins: vi.fn(),
  },
}));

const adaDbUji =
  Boolean(process.env.TEST_DATABASE_URL) &&
  Boolean(process.env.TEST_DATABASE_URL_MITRA);
const describeDb = adaDbUji ? describe : describe.skip;

const TENANT = "tenant-uji-klaim-fcm";
const TENANT_LAIN = "tenant-uji-klaim-fcm-lain";
const PAKET = "paket-uji-klaim-fcm";
const PROFIL = "profil-uji-klaim-fcm";
const PELANGGAN_A = "pel-uji-klaim-a";
const PELANGGAN_B = "pel-uji-klaim-b";
const STAF = "staf-uji-klaim-fcm";
const MITRA = "mitra-uji-klaim-fcm";
const INVESTOR = "investor-uji-klaim-fcm";

const TOKEN_PINDAH = "fcm-uji-klaim-perangkat-berpindah";
const SIDIK_TOKEN_PINDAH = createHash("sha256")
  .update(TOKEN_PINDAH)
  .digest("hex")
  .slice(0, 12);
const PESAN_AUDIT = "[FCM] Token dilepas dari pemilik lain";

const logWarn = vi.spyOn(logger, "warn");

/** Jejak audit pelepasan token dari pemilik lain sejak mock dikosongkan. */
function jejakAudit() {
  return logWarn.mock.calls
    .filter(([pesan]) => String(pesan).startsWith(PESAN_AUDIT))
    .map(([pesan, konteks]) => ({ pesan: String(pesan), konteks }));
}

const sesi = (role: string, id: string) => ({
  userId: id,
  id,
  role,
  tenantId: TENANT,
});

function dalamTenant<T>(callback: () => Promise<T>) {
  return runWithRequestTenantContext(
    { tenantId: TENANT, isSuperAdmin: false },
    callback,
  );
}

/** Seperti aplikasi memanggil POST /api/mobile/fcm-token setelah login. */
function daftarkan(role: string, id: string, fcmToken: string) {
  return dalamTenant(() =>
    updateMobileFcmToken({ session: sesi(role, id), fcmToken, action: "add" }),
  );
}

async function bersihkan() {
  await prismaAuth.pelanggan.deleteMany({
    where: { id: { in: [PELANGGAN_A, PELANGGAN_B] } },
  });
  await prismaAuth.hargaPaket.deleteMany({ where: { id: PAKET } });
  await prismaAuth.profilePPP.deleteMany({ where: { id: PROFIL } });
  await prismaAuth.user.deleteMany({ where: { id: STAF } });
  await prismaAuth.investor.deleteMany({ where: { id: INVESTOR } });
  await prismaMitraAuth.mitra.deleteMany({ where: { id: MITRA } });
}

async function siapkanPelanggan(id: string, idPelanggan: string) {
  await prismaAuth.pelanggan.create({
    data: {
      id,
      idPelanggan,
      nama: `Pelanggan ${id}`,
      username: id,
      password: "pppoe-uji",
      hargaPaketId: PAKET,
      tanggalAktif: new Date("2026-10-01T00:00:00+07:00"),
      jatuhTempo: new Date("2026-11-20T00:00:00+07:00"),
      status: "AKTIF",
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
}

async function siapkanData() {
  await prismaAuth.tenant.upsert({
    where: { id: TENANT },
    update: {},
    create: { id: TENANT, name: TENANT },
  });
  await prismaAuth.profilePPP.create({
    data: {
      id: PROFIL,
      name: PROFIL,
      localAddress: "10.0.0.1",
      remoteAddress: "pool-uji",
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
  await prismaAuth.hargaPaket.create({
    data: {
      id: PAKET,
      name: PAKET,
      profilePPPId: PROFIL,
      harga: 150000,
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
  await siapkanPelanggan(PELANGGAN_A, "99990881");
  await siapkanPelanggan(PELANGGAN_B, "99990882");
  await prismaAuth.user.create({
    data: {
      id: STAF,
      email: "staf-uji-klaim-fcm@uji.invalid",
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
  await prismaAuth.investor.create({
    data: {
      id: INVESTOR,
      username: "investor-uji-klaim-fcm",
      namaLengkap: "Investor Uji",
      tenantId: TENANT,
      updatedAt: new Date(),
    },
  });
  await prismaMitraAuth.mitra.create({
    data: {
      id: MITRA,
      name: "Mitra Uji",
      email: "mitra-uji-klaim-fcm@uji.invalid",
      tenantId: TENANT,
    },
  });
}

async function tokenPelanggan(id: string) {
  const pelanggan = await prismaAuth.pelanggan.findUniqueOrThrow({
    where: { id },
    select: { fcmTokens: true },
  });
  return pelanggan.fcmTokens;
}

async function tokenStaf() {
  return prismaAuth.user.findUniqueOrThrow({
    where: { id: STAF },
    select: { fcmTokens: true, pushToken: true },
  });
}

async function tokenMitra() {
  const mitra = await prismaMitraAuth.mitra.findUniqueOrThrow({
    where: { id: MITRA },
    select: { fcmTokens: true },
  });
  return mitra.fcmTokens;
}

async function tokenInvestor() {
  const investor = await prismaAuth.investor.findUniqueOrThrow({
    where: { id: INVESTOR },
    select: { fcmTokens: true },
  });
  return investor.fcmTokens;
}

/** Token yang dituju setiap multicast FCM sejak mock terakhir dikosongkan. */
function tokenFcmTerkirim(): string[] {
  return sendEachForMulticast.mock.calls.flatMap(
    ([pesan]) => (pesan as { tokens: string[] }).tokens,
  );
}

function pushTagihanUntuk(pelangganId: string) {
  return dalamTenant(() =>
    sendCustomerPushNotification(pelangganId, "Tagihan baru", "Rp150.000", {
      sourceType: "INVOICE",
      url: "/(customer)/tagihan",
    }),
  );
}

/** Seperti notifikasi langsung untuk satu staf (penugasan, persetujuan). */
function pushUntukStaf() {
  return dalamTenant(() =>
    deliverNotification({
      notification: {
        id: "notif-uji-klaim-fcm",
        type: "SYSTEM",
        priority: "NORMAL",
        title: "Work order baru",
        message: "WO-UJI",
        link: null,
        createdAt: new Date(),
      },
      data: {
        type: "SYSTEM",
        title: "Work order baru",
        message: "WO-UJI",
        userId: STAF,
        priority: "NORMAL",
        skipExpoPush: true,
      },
      userLookupService: new UserLookupService(),
    }),
  );
}

describeDb("token FCM berpindah pemilik", () => {
  beforeEach(async () => {
    logWarn.mockClear();
    sendEachForMulticast
      .mockReset()
      .mockImplementation(async (pesan: { tokens: string[] }) => ({
        successCount: pesan.tokens.length,
        failureCount: 0,
        responses: pesan.tokens.map(() => ({ success: true })),
      }));
    await bersihkan();
    await siapkanData();
  });

  afterAll(async () => {
    await bersihkan();
  });

  it("dari staf ke pelanggan: staf tidak lagi memegangnya dan push staf tidak dikirim ke sana", async () => {
    // Staf keluar paksa (sesi kedaluwarsa) tanpa melepas token perangkatnya.
    await prismaAuth.user.update({
      where: { id: STAF },
      data: {
        fcmTokens: [TOKEN_PINDAH, "fcm-uji-klaim-hp-staf"],
        pushToken: TOKEN_PINDAH,
      },
    });

    await daftarkan("CUSTOMER", PELANGGAN_A, TOKEN_PINDAH);

    expect(await tokenPelanggan(PELANGGAN_A)).toEqual([TOKEN_PINDAH]);
    expect(await tokenStaf()).toEqual({
      fcmTokens: ["fcm-uji-klaim-hp-staf"],
      pushToken: null,
    });

    sendEachForMulticast.mockClear();
    await pushUntukStaf();
    expect(tokenFcmTerkirim()).toEqual(["fcm-uji-klaim-hp-staf"]);
  });

  it("dari pelanggan A ke pelanggan B: push untuk A hanya ke perangkat A yang lain", async () => {
    await daftarkan("CUSTOMER", PELANGGAN_A, TOKEN_PINDAH);
    await daftarkan("CUSTOMER", PELANGGAN_A, "fcm-uji-klaim-hp-a");

    await daftarkan("CUSTOMER", PELANGGAN_B, TOKEN_PINDAH);

    expect(await tokenPelanggan(PELANGGAN_A)).toEqual(["fcm-uji-klaim-hp-a"]);
    expect(await tokenPelanggan(PELANGGAN_B)).toEqual([TOKEN_PINDAH]);

    sendEachForMulticast.mockClear();
    await pushTagihanUntuk(PELANGGAN_A);
    expect(tokenFcmTerkirim()).toEqual(["fcm-uji-klaim-hp-a"]);
  });

  it("dari pelanggan ke mitra di database lain: push untuk pelanggan tidak dikirim lagi", async () => {
    await daftarkan("CUSTOMER", PELANGGAN_A, TOKEN_PINDAH);

    await daftarkan("MITRA", MITRA, TOKEN_PINDAH);

    expect(await tokenMitra()).toEqual([TOKEN_PINDAH]);
    expect(await tokenPelanggan(PELANGGAN_A)).toEqual([]);

    sendEachForMulticast.mockClear();
    expect(await pushTagihanUntuk(PELANGGAN_A)).toBe(false);
    expect(tokenFcmTerkirim()).toEqual([]);
  });

  it("dari mitra ke pelanggan: mitra di database lain ikut melepasnya", async () => {
    await prismaMitraAuth.mitra.update({
      where: { id: MITRA },
      data: { fcmTokens: [TOKEN_PINDAH] },
    });

    await daftarkan("CUSTOMER", PELANGGAN_A, TOKEN_PINDAH);

    expect(await tokenPelanggan(PELANGGAN_A)).toEqual([TOKEN_PINDAH]);
    expect(await tokenMitra()).toEqual([]);
  });

  it("dari pelanggan ke investor: pelanggan tidak lagi memegangnya", async () => {
    await daftarkan("CUSTOMER", PELANGGAN_A, TOKEN_PINDAH);

    await new InvestorPushService().aturToken(INVESTOR, TOKEN_PINDAH, "add");

    expect(await tokenInvestor()).toEqual([TOKEN_PINDAH]);
    expect(await tokenPelanggan(PELANGGAN_A)).toEqual([]);
  });

  it("token ganda dari sebelum perbaikan ini lepas pada sinkron berikutnya", async () => {
    await prismaAuth.user.update({
      where: { id: STAF },
      data: { fcmTokens: [TOKEN_PINDAH] },
    });
    await prismaAuth.pelanggan.update({
      where: { id: PELANGGAN_A },
      data: { fcmTokens: [TOKEN_PINDAH] },
    });

    // Aplikasi pelanggan dibuka lagi dan menyinkronkan token yang sama.
    await daftarkan("CUSTOMER", PELANGGAN_A, TOKEN_PINDAH);

    expect(await tokenPelanggan(PELANGGAN_A)).toEqual([TOKEN_PINDAH]);
    expect((await tokenStaf()).fcmTokens).toEqual([]);
  });

  it("lintas tenant: token milik perangkat, bukan tenant", async () => {
    await prismaAuth.tenant.upsert({
      where: { id: TENANT_LAIN },
      update: {},
      create: { id: TENANT_LAIN, name: TENANT_LAIN },
    });
    await prismaAuth.pelanggan.update({
      where: { id: PELANGGAN_B },
      data: { tenantId: TENANT_LAIN, fcmTokens: [TOKEN_PINDAH] },
    });

    await daftarkan("CUSTOMER", PELANGGAN_A, TOKEN_PINDAH);

    expect(await tokenPelanggan(PELANGGAN_B)).toEqual([]);
    expect(await tokenPelanggan(PELANGGAN_A)).toEqual([TOKEN_PINDAH]);
  });

  it("mencatat jejak audit setiap kali token dilepas dari pemilik lain, tanpa menyebut tokennya", async () => {
    await daftarkan("CUSTOMER", PELANGGAN_A, TOKEN_PINDAH);
    expect(jejakAudit()).toEqual([]);

    await daftarkan("CUSTOMER", PELANGGAN_B, TOKEN_PINDAH);

    expect(jejakAudit()).toEqual([
      {
        pesan: PESAN_AUDIT,
        konteks: {
          tokenRef: SIDIK_TOKEN_PINDAH,
          claimant: { kind: "pelanggan", id: PELANGGAN_B, tenantId: TENANT },
          previousOwner: {
            kind: "pelanggan",
            id: PELANGGAN_A,
            tenantId: TENANT,
          },
          crossesTenant: false,
          crossesRole: false,
        },
      },
    ]);
    expect(JSON.stringify(logWarn.mock.calls)).not.toContain(TOKEN_PINDAH);
  });

  it("menandai jejak audit yang melintasi peran atau tenant", async () => {
    await prismaAuth.tenant.upsert({
      where: { id: TENANT_LAIN },
      update: {},
      create: { id: TENANT_LAIN, name: TENANT_LAIN },
    });
    await prismaAuth.user.update({
      where: { id: STAF },
      data: { tenantId: TENANT_LAIN, fcmTokens: [TOKEN_PINDAH] },
    });

    await daftarkan("MITRA", MITRA, TOKEN_PINDAH);

    expect(jejakAudit()).toEqual([
      {
        pesan: `${PESAN_AUDIT} (lintas tenant, lintas peran)`,
        konteks: expect.objectContaining({
          claimant: { kind: "mitra", id: MITRA, tenantId: TENANT },
          previousOwner: { kind: "user", id: STAF, tenantId: TENANT_LAIN },
          crossesTenant: true,
          crossesRole: true,
        }),
      },
    ]);
  });

  it("dari investor ke staf: investor tidak lagi memegangnya", async () => {
    await prismaAuth.investor.update({
      where: { id: INVESTOR },
      data: { fcmTokens: [TOKEN_PINDAH] },
    });

    await daftarkan("TEKNISI", STAF, TOKEN_PINDAH);

    expect((await tokenStaf()).fcmTokens).toEqual([TOKEN_PINDAH]);
    expect(await tokenInvestor()).toEqual([]);
  });
});
