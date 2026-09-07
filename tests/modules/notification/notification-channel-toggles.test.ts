import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tiga sakelar di Pengaturan Umum (`notifApp`, `notifWa`, `notifEmail`) selama
 * ini hanya disimpan dan dibaca halaman pengaturannya sendiri — nol pembacaan
 * di jalur pengiriman mana pun. Admin mematikan WhatsApp, WhatsApp tetap
 * terkirim.
 */

const mockContact = vi.fn();
vi.mock("@/modules/notification/services/channel-router", () => ({
  resolveCustomerContact: (...args: unknown[]) => mockContact(...args),
}));

const mockCreateNotification = vi.fn();
vi.mock("@/modules/notification/services/NotificationService", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

const mockSendPush = vi.fn();
vi.mock("@/modules/notification/services/ExpoPushService", () => ({
  sendCustomerPushNotification: (...args: unknown[]) => mockSendPush(...args),
}));

const mockSendWA = vi.fn();
vi.mock("@/modules/notification/services/whatsapp-sender.service", () => ({
  WhatsAppSenderService: vi.fn().mockImplementation(function (this: {
    send: typeof mockSendWA;
  }) {
    this.send = mockSendWA;
  }),
}));

const mockSendEmail = vi.fn();
vi.mock("@/modules/notification/services/email-service", () => ({
  EmailService: vi.fn().mockImplementation(function (this: {
    sendEmail: typeof mockSendEmail;
  }) {
    this.sendEmail = mockSendEmail;
  }),
}));

const mockToggles = vi.fn();
vi.mock("@/modules/settings", () => ({
  getNotificationChannelToggles: (...args: unknown[]) => mockToggles(...args),
}));

const mockRecordDlq = vi.fn();
vi.mock(
  "@/modules/notification/repositories/NotificationDeadLetterRepository",
  () => ({
    NotificationDeadLetterRepository: vi
      .fn()
      .mockImplementation(function (this: { record: typeof mockRecordDlq }) {
        this.record = mockRecordDlq;
      }),
  }),
);

import { NotificationDispatcher } from "@/modules/notification/services/NotificationDispatcher";

const dispatchInput = {
  pelangganId: "cust-1",
  templateKey: "invoicePaid" as const,
  params: {
    customerName: "Budi",
    invoiceNumber: "INV/1",
    amountDue: 100000,
  },
  sourceType: "BILLING",
  sourceId: "inv-1",
};

const allEnabled = { push: true, whatsapp: true, email: true };

beforeEach(() => {
  vi.clearAllMocks();
  mockContact.mockResolvedValue({
    userId: "user-1",
    customerId: "cust-1",
    customerName: "Budi",
    email: "budi@test.id",
    noTelp: "08123456789",
    isBillNotifEnabled: true,
    tenantId: "tenant-1",
  });
  mockCreateNotification.mockResolvedValue(undefined);
  mockSendPush.mockResolvedValue(undefined);
  mockSendWA.mockResolvedValue({ success: true });
  mockSendEmail.mockResolvedValue({ success: true });
  mockRecordDlq.mockResolvedValue(undefined);
  mockToggles.mockResolvedValue(allEnabled);
});

describe("toggle kanal tenant dihormati", () => {
  it("mengirim ke semua kanal saat semua sakelar menyala", async () => {
    await new NotificationDispatcher().dispatch(dispatchInput);

    expect(mockSendPush).toHaveBeenCalledTimes(1);
    expect(mockSendWA).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("tidak mengirim WhatsApp saat sakelarnya dimatikan", async () => {
    mockToggles.mockResolvedValue({ ...allEnabled, whatsapp: false });

    await new NotificationDispatcher().dispatch(dispatchInput);

    expect(mockSendWA).not.toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("tidak mengirim email saat sakelarnya dimatikan", async () => {
    mockToggles.mockResolvedValue({ ...allEnabled, email: false });

    await new NotificationDispatcher().dispatch(dispatchInput);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("tidak mengirim push saat sakelarnya dimatikan", async () => {
    mockToggles.mockResolvedValue({ ...allEnabled, push: false });

    await new NotificationDispatcher().dispatch(dispatchInput);

    expect(mockSendPush).not.toHaveBeenCalled();
  });

  // Baris notifikasi adalah jejak yang tetap dibutuhkan admin walau seluruh
  // kanal keluar dimatikan.
  it("tetap menulis notifikasi in-app walau semua kanal keluar dimatikan", async () => {
    mockToggles.mockResolvedValue({
      push: false,
      whatsapp: false,
      email: false,
    });

    await new NotificationDispatcher().dispatch(dispatchInput);

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
  });

  it("membaca sakelar milik tenant pelanggan", async () => {
    await new NotificationDispatcher().dispatch(dispatchInput);

    expect(mockToggles).toHaveBeenCalledWith("tenant-1");
  });
});
