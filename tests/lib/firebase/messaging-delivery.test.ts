import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEachForMulticast = vi.hoisted(() => vi.fn());
const clearStaleFcmTokens = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/admin", () => ({
  messaging: { sendEachForMulticast },
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/prisma-mitra", () => ({ prismaMitra: {} }));
vi.mock("@/modules/notification", () => ({ clearStaleFcmTokens }));

import { sendFCMNotification } from "@/lib/firebase/messaging";

interface SentAndroid {
  android: { notification: Record<string, string> };
}

function balasanFcm(
  responses: Array<{ success: boolean; error?: { code: string } }>,
) {
  const successCount = responses.filter((response) => response.success).length;
  return {
    successCount,
    failureCount: responses.length - successCount,
    responses,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Aplikasi membuat channel `high-priority-bubble` setiap kali dibuka dan
 * menjadikannya channel bawaan FCM di manifest. Menyebutnya di payload membuat
 * nada push tidak bergantung pada penunjuk manifest saja; perangkat yang belum
 * punya channel itu jatuh ke channel bawaan manifest, menurut dokumentasi FCM.
 */
describe("channel Android pada payload FCM", () => {
  it("push staf menyebut channel gelembung bersama tag dan nadanya", async () => {
    sendEachForMulticast.mockResolvedValue(balasanFcm([{ success: true }]));

    await sendFCMNotification(["token-staf"], "Work order baru", "WO-1", {
      url: "/admin/workorders/wo-1",
      sourceType: "WORK_ORDER",
    });

    const pesan = sendEachForMulticast.mock.calls[0]?.[0] as SentAndroid;
    expect(pesan.android.notification).toEqual({
      channelId: "high-priority-bubble",
      sound: "notif_soft",
      tag: "workorder",
    });
  });
});

describe("token yang ditolak FCM", () => {
  it("melepas token yang tidak terdaftar atau tidak sah, bukan yang gagal sementara", async () => {
    sendEachForMulticast.mockResolvedValue(
      balasanFcm([
        {
          success: false,
          error: { code: "messaging/registration-token-not-registered" },
        },
        {
          success: false,
          error: { code: "messaging/invalid-registration-token" },
        },
        { success: false, error: { code: "messaging/internal-error" } },
        { success: true },
      ]),
    );

    const terkirim = await sendFCMNotification(
      ["mati", "rusak", "sementara", "hidup"],
      "Judul",
      "Isi",
    );

    expect(clearStaleFcmTokens).toHaveBeenCalledWith(["mati", "rusak"]);
    expect(terkirim).toBe(1);
  });

  it("payload yang ditolak (invalid-argument) tidak membuang token siapa pun", async () => {
    // invalid-argument juga dipakai FCM untuk payload yang salah; bila
    // dianggap token mati, satu bug payload akan mengosongkan semua token.
    sendEachForMulticast.mockResolvedValue(
      balasanFcm([
        { success: false, error: { code: "messaging/invalid-argument" } },
        { success: false, error: { code: "messaging/invalid-argument" } },
      ]),
    );

    const terkirim = await sendFCMNotification(["a", "b"], "Judul", "Isi");

    expect(clearStaleFcmTokens).not.toHaveBeenCalled();
    expect(terkirim).toBe(0);
  });

  it("kegagalan memanggil FCM tidak dilempar dan dihitung tidak terkirim", async () => {
    sendEachForMulticast.mockRejectedValue(new Error("jaringan putus"));

    await expect(sendFCMNotification(["a"], "Judul", "Isi")).resolves.toBe(0);
  });
});
