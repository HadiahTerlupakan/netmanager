import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEachForMulticast = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  messaging: {
    sendEachForMulticast: (...args: unknown[]) => sendEachForMulticast(...args),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/prisma-mitra", () => ({ prismaMitra: {} }));
vi.mock("@/modules/notification", () => ({ clearStaleFcmTokens: vi.fn() }));

import { sendFCMNotification } from "@/lib/firebase/messaging";

/**
 * Nada notifikasi diganti dari bunyi bawaan perangkat ke nada lembut yang
 * dikirim bersama aplikasi (`assets/sounds/notif_soft.wav`).
 *
 * Sejak Android 8 suara ditentukan oleh channel, jadi sisi Android diarahkan
 * lewat penunjuk channel di manifest aplikasi. iOS berbeda: nadanya memang
 * disebut di payload APNs, sehingga server yang harus menyebutkannya.
 *
 * Pemasangan lama yang belum punya berkasnya jatuh kembali ke bunyi bawaan —
 * tidak ada notifikasi yang hilang karena perubahan ini.
 */
describe("nada notifikasi pada payload FCM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });
  });

  async function kirim() {
    await sendFCMNotification(["token-1"], "Judul", "Isi");
    return sendEachForMulticast.mock.calls[0]?.[0] as {
      apns: { payload: { aps: { sound: string } } };
      android: { notification: { sound: string } };
    };
  }

  it("menyebut nada kustom untuk iOS", async () => {
    const payload = await kirim();

    expect(payload.apns.payload.aps.sound).toBe("notif_soft.wav");
  });

  it("menyebut nada kustom untuk Android tanpa ekstensi", async () => {
    // Android merujuk berkas di res/raw tanpa ekstensi. Nilainya hanya dipakai
    // perangkat pra-Android 8; selebihnya channel yang menentukan.
    const payload = await kirim();

    expect(payload.android.notification.sound).toBe("notif_soft");
  });

  it("tidak lagi memakai bunyi bawaan perangkat", async () => {
    const payload = await kirim();

    expect(payload.apns.payload.aps.sound).not.toBe("default");
    expect(payload.android.notification.sound).not.toBe("default");
  });
});
