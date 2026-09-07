import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `Pelanggan.isBillNotifEnabled` dulu hanya dihormati di
 * `NotificationDispatcher`. Jalur push langsung — pembayaran ditolak
 * (`manual-payment-admin.helpers.ts`) dan pembayaran dibatalkan
 * (`PaymentCancellationService.ts`) — memanggil
 * `sendCustomerPushNotification` tanpa memeriksanya, sehingga pelanggan yang
 * sudah mematikan notifikasi tagihan tetap menerima push.
 *
 * Preferensi ditegakkan di pengirimnya supaya pemanggil baru ikut terjaga.
 */

const findByIdWithPushToken = vi.hoisted(() => vi.fn());
const postExpoPushChunk = vi.hoisted(() => vi.fn());

vi.mock("@/modules/pelanggan", () => ({
  PelangganPushTokenService: class {
    findByIdWithPushToken = findByIdWithPushToken;
    findManyWithPushToken = vi.fn();
    clearPushTokens = vi.fn();
  },
  PelangganRepository: class {},
}));

vi.mock("@/modules/notification/services/ExpoPushService.helpers", () => ({
  chunkExpoPushMessages: (messages: unknown[]): unknown[][] => [messages],
  collectChunkFailedTokens: (): unknown[] => [],
  buildChunkFailureTokens: (): unknown[] => [],
  createExpoPushMessage: (input: unknown) => input,
  postExpoPushChunk,
  delayBetweenExpoChunks: async () => {},
  processFailedExpoTokens: async () => {},
}));

const { sendCustomerPushNotification } =
  await import("@/modules/notification/services/ExpoPushService");

beforeEach(() => {
  vi.clearAllMocks();
  postExpoPushChunk.mockResolvedValue([{ status: "ok" }]);
});

describe("sendCustomerPushNotification menghormati preferensi", () => {
  it("mengirim saat pelanggan mengizinkan", async () => {
    findByIdWithPushToken.mockResolvedValue({
      id: "cust-1",
      pushToken: "ExponentPushToken[abc]",
      isBillNotifEnabled: true,
    });

    const sent = await sendCustomerPushNotification("cust-1", "Judul", "Isi");

    expect(sent).toBe(true);
    expect(postExpoPushChunk).toHaveBeenCalledTimes(1);
  });

  it("tidak mengirim saat pelanggan menonaktifkan notifikasi tagihan", async () => {
    findByIdWithPushToken.mockResolvedValue({
      id: "cust-1",
      pushToken: "ExponentPushToken[abc]",
      isBillNotifEnabled: false,
    });

    const sent = await sendCustomerPushNotification("cust-1", "Judul", "Isi");

    expect(sent).toBe(false);
    expect(postExpoPushChunk).not.toHaveBeenCalled();
  });

  it("tetap tidak mengirim saat pelanggan tidak punya token", async () => {
    findByIdWithPushToken.mockResolvedValue({
      id: "cust-1",
      pushToken: null,
      isBillNotifEnabled: true,
    });

    expect(await sendCustomerPushNotification("cust-1", "Judul", "Isi")).toBe(
      false,
    );
    expect(postExpoPushChunk).not.toHaveBeenCalled();
  });
});
