import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaAuth } from "@/lib/prisma";
import { runWithRequestTenantContext } from "@/lib/tenant-context";
import { NotificationDispatcher } from "@/modules/notification/services/NotificationDispatcher";
import { updateMobileFcmToken } from "@/modules/notification/services/MobileFcmTokenService";

/**
 * Aplikasi mobile sejak 2026-04-16 hanya mendaftarkan token FCM, untuk
 * pelanggan juga, tetapi `Pelanggan` hanya punya `pushToken` (token Expo lama)
 * dan pendaftaran token mencari pemiliknya di tabel `User`. Token pelanggan
 * tidak pernah tersimpan, dan push pelanggan hanya dikirim lewat Expo ke token
 * lama itu, sehingga pelanggan dengan aplikasi sekarang tidak menerima push.
 *
 * Dibuktikan terhadap Postgres sungguhan: token pelanggan tersimpan tanpa
 * ganda dan tetap dalam tenant-nya, dilepas saat logout, push tagihan sampai
 * lewat FCM (dan lewat Expo ke token lama), dan token yang ditolak FCM dilepas
 * dari baris pelanggan. FCM dan Expo di-mock; tidak ada push sungguhan.
 * Dilewati tanpa `TEST_DATABASE_URL` dan `TEST_DATABASE_URL_MITRA` (lihat
 * ./scripts/setup-test-db.sh).
 */

const sendEachForMulticast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/firebase/admin", () => ({
  messaging: { sendEachForMulticast },
}));
vi.mock("@/modules/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/settings")>()),
  getNotificationChannelToggles: async () => ({
    push: true,
    whatsapp: true,
    email: true,
  }),
}));

// Pendaftaran token juga melepas token dari baris mitra di database mitra.
const adaDbUji =
  Boolean(process.env.TEST_DATABASE_URL) &&
  Boolean(process.env.TEST_DATABASE_URL_MITRA);
const describeDb = adaDbUji ? describe : describe.skip;

const TENANT = "tenant-uji-fcm-pelanggan";
const TENANT_LAIN = "tenant-uji-fcm-pelanggan-lain";
const PELANGGAN = "pel-uji-fcm";
const PAKET = "paket-uji-fcm";
const PROFIL = "profil-uji-fcm";
const TOKEN_EXPO_LAMA = "ExponentPushToken[uji-fcm-lama]";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const SESI_PELANGGAN = {
  userId: PELANGGAN,
  id: PELANGGAN,
  role: "CUSTOMER",
  tenantId: TENANT,
};

const fetchExpo = vi.fn(async (_url: string, _init?: RequestInit) => ({
  ok: true,
  status: 200,
  json: async () => ({ data: [{ status: "ok" }] }),
}));

async function bersihkan() {
  await prismaAuth.pelanggan.deleteMany({ where: { id: PELANGGAN } });
  await prismaAuth.hargaPaket.deleteMany({ where: { id: PAKET } });
  await prismaAuth.profilePPP.deleteMany({ where: { id: PROFIL } });
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
  await prismaAuth.pelanggan.create({
    data: {
      id: PELANGGAN,
      idPelanggan: "99990777",
      nama: "Pelanggan Uji FCM",
      username: "uji-fcm-pelanggan",
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

function dalamTenant<T>(tenantId: string, callback: () => Promise<T>) {
  return runWithRequestTenantContext(
    { tenantId, isSuperAdmin: false },
    callback,
  );
}

/** Seperti aplikasi memanggil POST /api/mobile/fcm-token dengan sesi pelanggan. */
function aturToken(
  fcmToken: string,
  action: "add" | "remove" = "add",
  session = SESI_PELANGGAN,
) {
  return dalamTenant(session.tenantId, () =>
    updateMobileFcmToken({ session, fcmToken, action }),
  );
}

async function tokenPelanggan() {
  const pelanggan = await prismaAuth.pelanggan.findUniqueOrThrow({
    where: { id: PELANGGAN },
    select: { fcmTokens: true },
  });
  return pelanggan.fcmTokens;
}

/** Seperti event INVOICE_CREATED yang diteruskan handler ke dispatcher. */
function kirimPushTagihanBaru() {
  return dalamTenant(TENANT, () =>
    new NotificationDispatcher().dispatch({
      pelangganId: PELANGGAN,
      templateKey: "invoiceCreated",
      params: {
        customerName: "",
        invoiceNumber: "INV-UJI-FCM-1",
        amountDue: 150000,
      },
      sourceType: "INVOICE",
      sourceId: "inv-uji-fcm-1",
      channels: ["push"],
    }),
  );
}

function pesanFcmTerkirim() {
  return sendEachForMulticast.mock.calls.at(-1)?.[0] as {
    tokens: string[];
    data: Record<string, string>;
    android: {
      collapseKey: string;
      notification: { channelId?: string; tag?: string };
    };
  };
}

function tokenExpoTerkirim(): string[] {
  return fetchExpo.mock.calls
    .filter(([url]) => url === EXPO_PUSH_URL)
    .flatMap(([, init]) =>
      (JSON.parse(String(init?.body)) as Array<{ to: string }>).map(
        (message) => message.to,
      ),
    );
}

describeDb("token FCM pelanggan", () => {
  beforeEach(async () => {
    sendEachForMulticast.mockReset();
    fetchExpo.mockClear();
    vi.stubGlobal("fetch", fetchExpo);
    await bersihkan();
    await siapkanData();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await bersihkan();
  });

  it("menyimpan token pelanggan tanpa menggandakan token yang sama", async () => {
    await aturToken("fcm-a");
    await aturToken("fcm-a");
    await aturToken("fcm-b");

    expect(await tokenPelanggan()).toEqual(["fcm-a", "fcm-b"]);
  });

  it("login dan penyegaran token yang tiba bersamaan tetap satu token", async () => {
    await Promise.all([aturToken("fcm-a"), aturToken("fcm-a")]);

    expect(await tokenPelanggan()).toEqual(["fcm-a"]);
  });

  it("logout melepas token perangkat itu saja", async () => {
    await aturToken("fcm-a");
    await aturToken("fcm-b");

    await aturToken("fcm-a", "remove");

    expect(await tokenPelanggan()).toEqual(["fcm-b"]);
  });

  it("sesi tenant lain tidak menemukan pelanggan ini", async () => {
    await expect(
      aturToken("fcm-a", "add", { ...SESI_PELANGGAN, tenantId: TENANT_LAIN }),
    ).rejects.toMatchObject({ status: 404 });

    expect(await tokenPelanggan()).toEqual([]);
  });

  it("push tagihan dikirim lewat FCM ke token pelanggan dan lewat Expo ke token lama", async () => {
    await aturToken("fcm-a");
    await prismaAuth.pelanggan.update({
      where: { id: PELANGGAN },
      data: { pushToken: TOKEN_EXPO_LAMA },
    });
    sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });

    await kirimPushTagihanBaru();

    const pesan = pesanFcmTerkirim();
    expect(pesan.tokens).toEqual(["fcm-a"]);
    expect(pesan.data.url).toBe("/(customer)/tagihan");
    expect(pesan.android.collapseKey).toBe("billing");
    expect(pesan.android.notification).toMatchObject({
      channelId: "high-priority-bubble",
      tag: "billing",
    });
    expect(tokenExpoTerkirim()).toEqual([TOKEN_EXPO_LAMA]);
  });

  it("token yang ditolak FCM dilepas dari pelanggan", async () => {
    await aturToken("fcm-mati");
    await aturToken("fcm-hidup");
    sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        {
          success: false,
          error: { code: "messaging/registration-token-not-registered" },
        },
        { success: true },
      ],
    });

    await kirimPushTagihanBaru();

    expect(pesanFcmTerkirim().tokens).toEqual(["fcm-mati", "fcm-hidup"]);
    expect(await tokenPelanggan()).toEqual(["fcm-hidup"]);
    expect(tokenExpoTerkirim()).toEqual([]);
  });

  it("pelanggan yang mematikan notifikasi tagihan tidak dikirimi push", async () => {
    await aturToken("fcm-a");
    await prismaAuth.pelanggan.update({
      where: { id: PELANGGAN },
      data: { isBillNotifEnabled: false, pushToken: TOKEN_EXPO_LAMA },
    });

    await kirimPushTagihanBaru();

    expect(sendEachForMulticast).not.toHaveBeenCalled();
    expect(tokenExpoTerkirim()).toEqual([]);
  });
});
