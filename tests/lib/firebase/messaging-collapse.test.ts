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

interface SentMessage {
  data: Record<string, string>;
  android: {
    priority: string;
    collapseKey?: string;
    notification: { sound: string; tag?: string };
  };
  apns: {
    headers?: Record<string, string>;
    payload: { aps: { sound: string } };
  };
}

async function send(data?: Record<string, string>): Promise<SentMessage> {
  await sendFCMNotification(["token-1"], "Judul", "Isi", data);
  return sendEachForMulticast.mock.calls.at(-1)?.[0] as SentMessage;
}

function collapseFieldsOf(message: SentMessage) {
  return {
    collapseKey: message.android.collapseKey,
    tag: message.android.notification.tag,
    apnsCollapseId: message.apns.headers?.["apns-collapse-id"],
  };
}

/**
 * Selama ponsel offline atau aplikasi tertutup, FCM menyimpan push dan
 * Android menampilkan sekaligus membunyikan semuanya begitu tersambung lagi.
 * Push satu kategori kini saling menggantikan: yang tertunda hanya yang
 * terakhir, dan baki hanya memuat satu notifikasi per kategori.
 */
describe("FCM pushes collapse per category", () => {
  beforeEach(() => {
    sendEachForMulticast.mockReset().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });
  });

  it.each([
    [
      "a work order",
      "workorder",
      { url: "/admin/workorders/wo-1", sourceType: "WORK_ORDER" },
    ],
    [
      "a work order request from the app",
      "workorder",
      { url: "/admin/workorders/list?status=REQUESTED", sourceType: "" },
    ],
    [
      "a complaint ticket",
      "ticket",
      { url: "/admin/support/ticket-1", sourceType: "KELUHAN" },
    ],
    [
      "an uploaded payment receipt",
      "billing",
      { url: "/admin/payments/approval" },
    ],
    [
      "a gateway payment to review",
      "billing",
      { url: "/admin/finance/payment-gateway", sourceType: "PaymentReview" },
    ],
    [
      "a customer invoice",
      "billing",
      { url: "/tagihan", sourceType: "BILLING" },
    ],
    [
      "an announcement",
      "announcement",
      { url: "/employee/notifications", sourceType: "ANNOUNCEMENT" },
    ],
    [
      "anything else",
      "general",
      { url: "/employee/notifications", sourceType: "LEAVE" },
    ],
  ])("files %s under %s", async (_kind, category, data) => {
    const message = await send(data);

    expect(collapseFieldsOf(message)).toEqual({
      collapseKey: category,
      tag: category,
      apnsCollapseId: category,
    });
  });

  it("keeps each chat conversation apart so one does not replace another", async () => {
    const first = await send({ url: "/chat", conversationId: "conv-a" });
    const second = await send({ url: "/chat", conversationId: "conv-b" });

    expect(collapseFieldsOf(first)).toEqual({
      collapseKey: "chat-conv-a",
      tag: "chat-conv-a",
      apnsCollapseId: "chat-conv-a",
    });
    expect(collapseFieldsOf(second).collapseKey).toBe("chat-conv-b");
  });

  it("collapses a push without any data with the other general ones", async () => {
    const message = await send();

    expect(collapseFieldsOf(message).collapseKey).toBe("general");
  });

  it("keeps the deep link, the custom sounds and the high priority", async () => {
    const message = await send({
      url: "/admin/workorders/wo-1",
      sourceType: "WORK_ORDER",
    });

    expect(message.data.url).toBe("/admin/workorders/wo-1");
    expect(message.android.priority).toBe("high");
    expect(message.android.notification.sound).toBe("notif_soft");
    expect(message.apns.payload.aps.sound).toBe("notif_soft.wav");
  });
});
