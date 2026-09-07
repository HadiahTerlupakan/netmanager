import { describe, it, expect, vi, beforeEach } from "vitest";

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

const mockRecordDlq = vi.hoisted(() => vi.fn());

const mockSendEmail = vi.fn();
vi.mock("@/modules/notification/services/email-service", () => ({
  EmailService: vi.fn().mockImplementation(function (this: {
    sendEmail: typeof mockSendEmail;
  }) {
    this.sendEmail = mockSendEmail;
  }),
}));

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

describe("NotificationDispatcher", () => {
  const fullContact = {
    userId: "user-1",
    customerId: "cust-1",
    customerName: "Budi",
    email: "budi@test.id",
    noTelp: "08123456789",
    isBillNotifEnabled: true,
    tenantId: "tenant-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockContact.mockResolvedValue(fullContact);
    mockCreateNotification.mockResolvedValue(undefined);
    mockSendPush.mockResolvedValue(undefined);
    mockSendWA.mockResolvedValue({ success: true });
    mockSendEmail.mockResolvedValue({ success: true });
    mockRecordDlq.mockResolvedValue(undefined);
  });

  it("skip semua channel ketika isBillNotifEnabled = false", async () => {
    mockContact.mockResolvedValueOnce({
      ...fullContact,
      isBillNotifEnabled: false,
    });
    await new NotificationDispatcher().dispatch({
      pelangganId: "cust-1",
      templateKey: "invoicePaid",
      params: {
        customerName: "Budi",
        invoiceNumber: "INV/1",
        amountDue: 100000,
      },
      sourceType: "BILLING",
      sourceId: "inv-1",
    });
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockSendPush).not.toHaveBeenCalled();
    expect(mockSendWA).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("dispatch ke 4 channel saat enabled + semua kontak tersedia", async () => {
    await new NotificationDispatcher().dispatch({
      pelangganId: "cust-1",
      templateKey: "invoicePaid",
      params: {
        customerName: "Budi",
        invoiceNumber: "INV/1",
        amountDue: 100000,
      },
      sourceType: "BILLING",
      sourceId: "inv-1",
    });
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockSendPush).toHaveBeenCalledTimes(1);
    expect(mockSendWA).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("skip email kalau kontak tidak punya email", async () => {
    mockContact.mockResolvedValueOnce({ ...fullContact, email: null });
    await new NotificationDispatcher().dispatch({
      pelangganId: "cust-1",
      templateKey: "invoicePaid",
      params: {
        customerName: "Budi",
        invoiceNumber: "INV/1",
        amountDue: 100000,
      },
      sourceType: "BILLING",
      sourceId: "inv-1",
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendWA).toHaveBeenCalledTimes(1);
  });

  it("skip whatsapp kalau kontak tidak punya noTelp", async () => {
    mockContact.mockResolvedValueOnce({ ...fullContact, noTelp: null });
    await new NotificationDispatcher().dispatch({
      pelangganId: "cust-1",
      templateKey: "invoicePaid",
      params: {
        customerName: "Budi",
        invoiceNumber: "INV/1",
        amountDue: 100000,
      },
      sourceType: "BILLING",
      sourceId: "inv-1",
    });
    expect(mockSendWA).not.toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("skip in-app kalau kontak tidak punya userId", async () => {
    mockContact.mockResolvedValueOnce({ ...fullContact, userId: null });
    await new NotificationDispatcher().dispatch({
      pelangganId: "cust-1",
      templateKey: "invoicePaid",
      params: {
        customerName: "Budi",
        invoiceNumber: "INV/1",
        amountDue: 100000,
      },
      sourceType: "BILLING",
      sourceId: "inv-1",
    });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("best-effort — channel gagal tidak mencegah channel lain jalan", async () => {
    mockSendWA.mockRejectedValueOnce(new Error("WA provider error"));
    await new NotificationDispatcher().dispatch({
      pelangganId: "cust-1",
      templateKey: "invoicePaid",
      params: {
        customerName: "Budi",
        invoiceNumber: "INV/1",
        amountDue: 100000,
      },
      sourceType: "BILLING",
      sourceId: "inv-1",
    });
    expect(mockSendWA).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockSendPush).toHaveBeenCalledTimes(1);
  });

  it("return early ketika pelanggan tidak ditemukan", async () => {
    mockContact.mockResolvedValueOnce(null);
    await new NotificationDispatcher().dispatch({
      pelangganId: "nonexistent",
      templateKey: "invoicePaid",
      params: { customerName: "", invoiceNumber: "INV/1", amountDue: 100000 },
      sourceType: "BILLING",
      sourceId: "inv-1",
    });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("enrich params dengan customerName dari contact kalau tidak di-pass", async () => {
    await new NotificationDispatcher().dispatch({
      pelangganId: "cust-1",
      templateKey: "customerWelcome",
      params: { customerName: "", username: "budi123" },
      sourceType: "LIFECYCLE",
      sourceId: "cust-1",
    });
    // Harus pakai "Budi" dari contact
    const waCall = mockSendWA.mock.calls[0][0];
    expect(waCall.message).toContain("Budi");
  });

  it("filter channel via opsi `channels`", async () => {
    await new NotificationDispatcher().dispatch({
      pelangganId: "cust-1",
      templateKey: "invoicePaid",
      params: {
        customerName: "Budi",
        invoiceNumber: "INV/1",
        amountDue: 100000,
      },
      sourceType: "BILLING",
      sourceId: "inv-1",
      channels: ["whatsapp"],
    });
    expect(mockSendWA).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendPush).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});

/**
 * `WhatsAppSenderService.send` dan `EmailService.sendEmail` mengembalikan
 * `{success:false}` alih-alih melempar. Dispatcher dulu hanya `await` tanpa
 * memeriksa nilai baliknya, sedangkan DLQ hanya terisi dari blok `catch` —
 * jadi dua kanal itu bisa gagal terus-menerus tanpa satu baris pun muncul di
 * halaman dead-letter.
 */
describe("kegagalan kanal masuk DLQ", () => {
  // Blok ini bersaudara dengan describe utama, jadi mock harus disiapkan
  // sendiri — beforeEach di sana tidak berlaku di sini.
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
  });

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

  const dlqEntries = () =>
    mockRecordDlq.mock.calls.map(([entry]) => entry as { channel: string });

  it("mencatat kegagalan WhatsApp ke DLQ", async () => {
    mockSendWA.mockResolvedValue({ success: false, error: "nomor diblokir" });

    await new NotificationDispatcher().dispatch(dispatchInput);

    expect(dlqEntries()).toContainEqual(
      expect.objectContaining({ channel: "whatsapp", error: "nomor diblokir" }),
    );
  });

  it("mencatat kegagalan email ke DLQ", async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: "SMTP timeout" });

    await new NotificationDispatcher().dispatch(dispatchInput);

    expect(dlqEntries()).toContainEqual(
      expect.objectContaining({ channel: "email", error: "SMTP timeout" }),
    );
  });

  // Guard dedupe sengaja melewati pengiriman; itu bukan kegagalan dan tidak
  // boleh mengotori DLQ.
  it("tidak mencatat email yang dilewati guard dedupe", async () => {
    mockSendEmail.mockResolvedValue({ success: false, deduped: true });

    await new NotificationDispatcher().dispatch(dispatchInput);

    expect(dlqEntries().some((entry) => entry.channel === "email")).toBe(false);
  });

  it("tidak mencatat apa pun saat semua kanal berhasil", async () => {
    await new NotificationDispatcher().dispatch(dispatchInput);

    expect(mockRecordDlq).not.toHaveBeenCalled();
  });
});
