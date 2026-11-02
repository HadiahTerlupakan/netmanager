import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserFcmTokens: vi.fn(),
  getMitraFcmTokens: vi.fn(),
  sendFCMNotification: vi.fn(),
  sendPushToUsers: vi.fn(),
}));

vi.mock("@/lib/firebase/messaging", () => ({
  getUserFcmTokens: mocks.getUserFcmTokens,
  getMitraFcmTokens: mocks.getMitraFcmTokens,
  sendFCMNotification: mocks.sendFCMNotification,
}));
vi.mock("@/modules/notification/services/ExpoPushService", () => ({
  sendPushToUsers: mocks.sendPushToUsers,
}));

import { sendPushToActors } from "@/modules/notification/services/ActorPushService";

describe("sendPushToActors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserFcmTokens.mockResolvedValue(["fcm-karyawan"]);
    mocks.getMitraFcmTokens.mockResolvedValue(["fcm-mitra"]);
    mocks.sendFCMNotification.mockResolvedValue(2);
    mocks.sendPushToUsers.mockResolvedValue(0);
  });

  // Chat dulu hanya memakai Expo (`pushToken`); aplikasi sekarang mendaftar
  // lewat FCM (`fcmTokens`), jadi notifikasi chat tidak pernah sampai.
  it("mengirim lewat FCM ke token karyawan dan mitra", async () => {
    await sendPushToActors(
      [
        { type: "user", id: "user-2" },
        { type: "mitra", id: "mitra-1" },
      ],
      "Chat Budi",
      "Budi: halo",
      { type: "chat_message", conversationId: "conv-1", messageId: "m1" },
    );

    expect(mocks.getUserFcmTokens).toHaveBeenCalledWith(["user-2"]);
    expect(mocks.getMitraFcmTokens).toHaveBeenCalledWith(["mitra-1"]);
    expect(mocks.sendFCMNotification).toHaveBeenCalledWith(
      ["fcm-karyawan", "fcm-mitra"],
      "Chat Budi",
      "Budi: halo",
      { type: "chat_message", conversationId: "conv-1", messageId: "m1" },
    );
  });

  it("tetap mengirim Expo untuk pemasangan aplikasi lama", async () => {
    await sendPushToActors([{ type: "user", id: "user-2" }], "Judul", "Isi");

    expect(mocks.sendPushToUsers).toHaveBeenCalledWith(
      ["user-2"],
      "Judul",
      "Isi",
      undefined,
    );
  });

  it("kanal FCM yang gagal tidak menahan kanal Expo", async () => {
    mocks.sendFCMNotification.mockRejectedValueOnce(new Error("FCM down"));

    await expect(
      sendPushToActors([{ type: "user", id: "user-2" }], "J", "I"),
    ).resolves.toBeDefined();
    expect(mocks.sendPushToUsers).toHaveBeenCalled();
  });

  it("tidak memanggil FCM bila tidak ada token", async () => {
    mocks.getUserFcmTokens.mockResolvedValueOnce([]);
    mocks.getMitraFcmTokens.mockResolvedValueOnce([]);

    await sendPushToActors([{ type: "user", id: "user-2" }], "J", "I");

    expect(mocks.sendFCMNotification).not.toHaveBeenCalled();
  });
});
