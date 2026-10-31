import { beforeEach, describe, expect, it, vi } from "vitest";

const expoSdk = vi.hoisted(() => ({
  sendPushNotificationsAsync: vi.fn(async (_messages: unknown[]) => []),
}));

vi.mock("expo-server-sdk", () => ({
  Expo: class {
    static isExpoPushToken() {
      return true;
    }
    chunkPushNotifications(messages: unknown[]) {
      return [messages];
    }
    sendPushNotificationsAsync = expoSdk.sendPushNotificationsAsync;
  },
}));

import { sendExpoPushNotifications } from "@/lib/expo";
import { createExpoPushMessage } from "@/modules/notification/services/ExpoPushService.helpers";
import { sendRetryExpoPush } from "@/modules/notification/services/PushRetryQueue.helpers";

type ExpoMessage = Record<string, unknown>;

function buildMessage(data: Record<string, unknown>): ExpoMessage {
  return createExpoPushMessage({
    token: "ExponentPushToken[abc]",
    title: "Judul",
    body: "Isi",
    data,
  }) as unknown as ExpoMessage;
}

/**
 * Push lewat Expo kini hanya sampai ke pemasangan lama yang masih mendaftarkan
 * token Expo (aplikasi berhenti melakukannya sejak 2026-04-16). Saat ponsel
 * offline, push satu kategori digabung (`collapseId`) dan menggantikan yang
 * sudah tampil (`tag`), sama seperti push FCM.
 */
describe("Expo push messages", () => {
  beforeEach(() => {
    expoSdk.sendPushNotificationsAsync.mockClear();
  });

  it.each([
    [
      "a chat message",
      "chat-conv-1",
      { type: "chat_message", conversationId: "conv-1" },
    ],
    [
      "a broadcast",
      "chat-global",
      { type: "broadcast", conversationId: "global" },
    ],
    ["a work order", "workorder", { workOrderId: "wo-1", type: "WORK_ORDER" }],
    [
      "a work order request",
      "workorder",
      { workOrderId: "wo-1", type: "WO_REQUEST" },
    ],
    [
      "a staff notification that only carries a link",
      "ticket",
      { link: "/admin/support/ticket-1", sourceId: "ticket-1" },
    ],
    [
      "a customer bill",
      "billing",
      { sourceType: "INVOICE_DUE", url: "/(customer)/tagihan" },
    ],
    [
      "anything else",
      "general",
      { type: "CANVASING_COMPLETED", canvasingId: "c-1" },
    ],
  ])("collapses %s under %s", (_kind, category, data) => {
    const message = buildMessage(data);

    expect(message.collapseId).toBe(category);
    expect(message.tag).toBe(category);
  });

  it("names the bubble tone for iOS and leaves Android on the channel every Expo-era install has", () => {
    const message = buildMessage({ workOrderId: "wo-1", type: "WORK_ORDER" });

    // Expo membuang push yang channel-nya tidak ada di perangkat; pemasangan
    // era Expo hanya punya channel `default`, bukan high-priority-bubble.
    expect(message.sound).toBe("notif_soft.wav");
    expect(message).not.toHaveProperty("channelId");
  });

  it("keeps the data the app opens", () => {
    const message = buildMessage({ workOrderId: "wo-1", type: "WORK_ORDER" });

    expect(message.data).toEqual({ workOrderId: "wo-1", type: "WORK_ORDER" });
  });

  it("sends a retried push with the same collapse key and tone", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      json: async () => ({ data: [{ status: "ok" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await sendRetryExpoPush({
      id: "retry-1",
      type: "expo",
      userId: "user-1",
      title: "Judul",
      body: "Isi",
      data: { type: "chat_message", conversationId: "conv-9" },
      retryCount: 1,
      createdAt: Date.now(),
      pushToken: "ExponentPushToken[abc]",
    });

    const [sent] = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body));
    expect(sent).toMatchObject({
      to: "ExponentPushToken[abc]",
      collapseId: "chat-conv-9",
      tag: "chat-conv-9",
      sound: "notif_soft.wav",
    });
    vi.unstubAllGlobals();
  });

  it("collapses announcements sent through the Expo SDK", async () => {
    await sendExpoPushNotifications(
      ["ExponentPushToken[a]", "ExponentPushToken[b]"],
      "Pengumuman",
      "Isi",
      { announcementId: "ann-1", url: "/announcement" },
    );

    const messages = expoSdk.sendPushNotificationsAsync.mock.calls[0]?.[0];
    expect(messages).toEqual([
      expect.objectContaining({
        to: "ExponentPushToken[a]",
        collapseId: "announcement",
        tag: "announcement",
        sound: "notif_soft.wav",
      }),
      expect.objectContaining({ to: "ExponentPushToken[b]" }),
    ]);
  });
});
