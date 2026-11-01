import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Aplikasi sejak 2026-04-16 hanya mendaftarkan token FCM, untuk pelanggan juga,
 * tetapi push pelanggan dulu hanya dikirim lewat Expo ke `Pelanggan.pushToken`
 * (token aplikasi era Expo). Pelanggan dengan aplikasi sekarang tidak menerima
 * push apa pun. Push pelanggan kini dikirim lewat FCM ke `fcmTokens` dan tetap
 * lewat Expo ke token lama bila masih ada.
 *
 * `Pelanggan.isBillNotifEnabled` dulu hanya dihormati di
 * `NotificationDispatcher`; jalur push langsung (pembayaran ditolak atau
 * dibatalkan) melewatinya. Preferensi ditegakkan di pengirimnya supaya
 * pemanggil baru ikut terjaga, untuk kedua kanal.
 */

const findByIdWithPushToken = vi.hoisted(() => vi.fn());
const sendEachForMulticast = vi.hoisted(() => vi.fn());

vi.mock("@/modules/pelanggan", () => ({
  PelangganPushTokenService: class {
    findByIdWithPushToken = findByIdWithPushToken;
    findManyWithPushToken = vi.fn();
    clearPushTokens = vi.fn();
  },
  PelangganRepository: class {},
}));
vi.mock("@/lib/firebase/admin", () => ({
  messaging: { sendEachForMulticast },
}));
vi.mock("@/modules/notification", () => ({ clearStaleFcmTokens: vi.fn() }));

const { sendCustomerPushNotification } =
  await import("@/modules/notification/services/CustomerPushService");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const TOKEN_EXPO_LAMA = "ExponentPushToken[lama]";
const DATA_TAGIHAN = {
  sourceType: "INVOICE",
  sourceId: "inv-1",
  url: "/(customer)/tagihan",
};

const fetchExpo = vi.fn(async (_url: string, _init?: RequestInit) => ({
  ok: true,
  status: 200,
  json: async () => ({ data: [{ status: "ok" }] }),
}));

interface PenerimaPushUji {
  id: string;
  pushToken: string | null;
  fcmTokens: string[];
  isBillNotifEnabled: boolean;
}

function pelanggan(overrides: Partial<PenerimaPushUji> = {}): PenerimaPushUji {
  return {
    id: "cust-1",
    pushToken: null,
    fcmTokens: [],
    isBillNotifEnabled: true,
    ...overrides,
  };
}

function fcmMenerima(jumlah: number) {
  sendEachForMulticast.mockResolvedValue({
    successCount: jumlah,
    failureCount: 0,
    responses: Array.from({ length: jumlah }, () => ({ success: true })),
  });
}

function pesanFcm() {
  return sendEachForMulticast.mock.calls.at(-1)?.[0] as {
    tokens: string[];
    data: Record<string, string>;
    android: {
      collapseKey: string;
      notification: Record<string, string>;
    };
    apns: { headers: Record<string, string> };
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchExpo);
  fcmMenerima(1);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("sendCustomerPushNotification", () => {
  it("mengirim push tagihan lewat FCM ke semua perangkat pelanggan, digabung per kategori", async () => {
    findByIdWithPushToken.mockResolvedValue(
      pelanggan({ fcmTokens: ["fcm-hp", "fcm-tablet"] }),
    );
    fcmMenerima(2);

    const terkirim = await sendCustomerPushNotification(
      "cust-1",
      "Tagihan baru dibuat",
      "Tagihan INV-1: Rp150.000",
      DATA_TAGIHAN,
    );

    expect(terkirim).toBe(true);
    const pesan = pesanFcm();
    expect(pesan.tokens).toEqual(["fcm-hp", "fcm-tablet"]);
    expect(pesan.data).toEqual(DATA_TAGIHAN);
    expect(pesan.android.collapseKey).toBe("billing");
    expect(pesan.android.notification).toMatchObject({
      channelId: "high-priority-bubble",
      tag: "billing",
    });
    expect(pesan.apns.headers["apns-collapse-id"]).toBe("billing");
    expect(tokenExpoTerkirim()).toEqual([]);
  });

  it("tetap mengirim lewat Expo ke token lama, di samping FCM", async () => {
    findByIdWithPushToken.mockResolvedValue(
      pelanggan({ fcmTokens: ["fcm-hp"], pushToken: TOKEN_EXPO_LAMA }),
    );

    await sendCustomerPushNotification("cust-1", "Judul", "Isi", DATA_TAGIHAN);

    expect(pesanFcm().tokens).toEqual(["fcm-hp"]);
    expect(tokenExpoTerkirim()).toEqual([TOKEN_EXPO_LAMA]);
  });

  it("pemasangan era Expo tanpa token FCM tetap menerima push lewat Expo", async () => {
    findByIdWithPushToken.mockResolvedValue(
      pelanggan({ pushToken: TOKEN_EXPO_LAMA }),
    );

    const terkirim = await sendCustomerPushNotification(
      "cust-1",
      "Judul",
      "Isi",
      DATA_TAGIHAN,
    );

    expect(terkirim).toBe(true);
    expect(sendEachForMulticast).not.toHaveBeenCalled();
    expect(tokenExpoTerkirim()).toEqual([TOKEN_EXPO_LAMA]);
  });

  it("data push diubah ke string untuk FCM; nilai kosong dibuang", async () => {
    findByIdWithPushToken.mockResolvedValue(
      pelanggan({ fcmTokens: ["fcm-hp"] }),
    );

    await sendCustomerPushNotification("cust-1", "Judul", "Isi", {
      paymentId: "pay-1",
      amount: 150000,
      isPartial: true,
      note: null,
      reason: undefined,
    });

    expect(pesanFcm().data).toEqual({
      paymentId: "pay-1",
      amount: "150000",
      isPartial: "true",
    });
  });

  it("tidak mengirim apa pun saat pelanggan menonaktifkan notifikasi tagihan", async () => {
    findByIdWithPushToken.mockResolvedValue(
      pelanggan({
        fcmTokens: ["fcm-hp"],
        pushToken: TOKEN_EXPO_LAMA,
        isBillNotifEnabled: false,
      }),
    );

    const terkirim = await sendCustomerPushNotification("cust-1", "J", "I");

    expect(terkirim).toBe(false);
    expect(sendEachForMulticast).not.toHaveBeenCalled();
    expect(tokenExpoTerkirim()).toEqual([]);
  });

  it("pelanggan tanpa token apa pun tidak dikirimi apa-apa", async () => {
    findByIdWithPushToken.mockResolvedValue(pelanggan());

    expect(await sendCustomerPushNotification("cust-1", "J", "I")).toBe(false);
    expect(sendEachForMulticast).not.toHaveBeenCalled();
    expect(tokenExpoTerkirim()).toEqual([]);
  });

  it("pelanggan yang tidak ditemukan tidak dikirimi apa-apa", async () => {
    findByIdWithPushToken.mockResolvedValue(null);

    expect(await sendCustomerPushNotification("cust-x", "J", "I")).toBe(false);
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it("FCM yang gagal tidak menahan push Expo ke token lama", async () => {
    findByIdWithPushToken.mockResolvedValue(
      pelanggan({ fcmTokens: ["fcm-hp"], pushToken: TOKEN_EXPO_LAMA }),
    );
    sendEachForMulticast.mockRejectedValue(new Error("FCM tidak terjangkau"));

    const terkirim = await sendCustomerPushNotification("cust-1", "J", "I");

    expect(terkirim).toBe(true);
    expect(tokenExpoTerkirim()).toEqual([TOKEN_EXPO_LAMA]);
  });

  it("melaporkan tidak terkirim bila FCM menolak semua token", async () => {
    findByIdWithPushToken.mockResolvedValue(
      pelanggan({ fcmTokens: ["fcm-hp"] }),
    );
    sendEachForMulticast.mockResolvedValue({
      successCount: 0,
      failureCount: 1,
      responses: [
        {
          success: false,
          error: { code: "messaging/registration-token-not-registered" },
        },
      ],
    });

    expect(await sendCustomerPushNotification("cust-1", "J", "I")).toBe(false);
  });
});
