import { beforeEach, describe, expect, it, vi } from "vitest";

const mockContact = vi.hoisted(() => vi.fn());
const mockSendWA = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() => vi.fn());
const mockGeneralSettings = vi.hoisted(() => vi.fn());

vi.mock("@/modules/settings", () => ({
  getNotificationChannelToggles: async () => ({
    push: true,
    whatsapp: true,
    email: true,
  }),
  getGeneralSettings: (...args: unknown[]) => mockGeneralSettings(...args),
}));
vi.mock("@/lib/redis", () => ({
  redis: { set: vi.fn().mockResolvedValue("OK") },
}));
vi.mock("@/modules/notification/services/channel-router", () => ({
  resolveCustomerContact: (...args: unknown[]) => mockContact(...args),
}));
vi.mock(
  "@/modules/notification/services/CustomerInAppNotificationService",
  () => ({
    createCustomerNotification: vi.fn(),
  }),
);
vi.mock("@/modules/notification/services/CustomerPushService", () => ({
  sendCustomerPushNotification: vi.fn(),
}));
vi.mock("@/modules/notification/services/whatsapp-sender.service", () => ({
  WhatsAppSenderService: vi.fn().mockImplementation(function (this: {
    send: unknown;
  }) {
    this.send = mockSendWA;
  }),
}));
vi.mock("@/modules/notification/services/email-service", () => ({
  EmailService: vi.fn().mockImplementation(function (this: {
    sendEmail: unknown;
  }) {
    this.sendEmail = mockSendEmail;
  }),
}));
vi.mock(
  "@/modules/notification/repositories/NotificationDeadLetterRepository",
  () => ({
    NotificationDeadLetterRepository: vi
      .fn()
      .mockImplementation(function (this: { record: unknown }) {
        this.record = vi.fn();
      }),
  }),
);

import { NotificationDispatcher } from "@/modules/notification/services/NotificationDispatcher";
import { appendIssuerSignOff } from "@/modules/notification/templates/billing-templates";

const CONTACT = {
  userId: "user-1",
  customerId: "cust-1",
  customerName: "Budi",
  email: "budi@test.id",
  noTelp: "08123456789",
  isBillNotifEnabled: true,
  tenantId: "tenant-isp",
};

function dispatchInvoiceCreated() {
  return new NotificationDispatcher().dispatch({
    pelangganId: "cust-1",
    templateKey: "invoiceCreated",
    params: { customerName: "Budi", invoiceNumber: "INV-1", amountDue: 150000 },
    sourceType: "invoice",
    sourceId: "inv-1",
    channels: ["whatsapp", "email"],
  });
}

describe("NotificationDispatcher — nama ISP penerbit tagihan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContact.mockResolvedValue(CONTACT);
    mockSendWA.mockResolvedValue({ success: true });
    mockSendEmail.mockResolvedValue({ success: true });
    mockGeneralSettings.mockResolvedValue({ perusahaan: "PT RadPro Net" });
  });

  it("pesan WhatsApp dan email tagihan ditutup dengan nama ISP milik tenant pelanggan", async () => {
    await dispatchInvoiceCreated();

    expect(mockGeneralSettings).toHaveBeenCalledWith(undefined, "tenant-isp");
    expect(mockSendWA.mock.calls[0][0].message).toMatch(
      /Salam,\nPT RadPro Net$/,
    );
    expect(mockSendEmail.mock.calls[0][0].text).toMatch(
      /Salam,\nPT RadPro Net$/,
    );
  });

  it("tanpa nama perusahaan, pesan dikirim apa adanya", async () => {
    mockGeneralSettings.mockResolvedValue({ perusahaan: "  " });

    await dispatchInvoiceCreated();

    expect(mockSendWA.mock.calls[0][0].message).not.toContain("Salam,");
  });

  it("gagal membaca pengaturan tidak menahan notifikasi", async () => {
    mockGeneralSettings.mockRejectedValue(new Error("db down"));

    await dispatchInvoiceCreated();

    expect(mockSendWA).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("pelanggan tanpa tenant tidak membaca pengaturan tenant mana pun", async () => {
    mockContact.mockResolvedValue({ ...CONTACT, tenantId: null });

    await dispatchInvoiceCreated();

    expect(mockGeneralSettings).not.toHaveBeenCalled();
    expect(mockSendWA.mock.calls[0][0].message).not.toContain("Salam,");
  });
});

describe("appendIssuerSignOff", () => {
  it("menambah penutup bernama ISP dan membiarkan teks bila nama kosong", () => {
    expect(appendIssuerSignOff("Halo", " PT X ")).toBe("Halo\n\nSalam,\nPT X");
    expect(appendIssuerSignOff("Halo", undefined)).toBe("Halo");
  });
});
