import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  findManyByKeys: vi.fn(),
  findUnpaidInvoices: vi.fn(),
  acquireCronLock: vi.fn(),
  onInvoiceReminderDue: vi.fn(),
}));

vi.mock("@/lib/cron-lock", () => ({
  acquireCronLock: mockFns.acquireCronLock,
}));

vi.mock("@/modules/attendance", () => ({
  AttendanceSettingsService: class {
    findManyByKeys = mockFns.findManyByKeys;
  },
}));

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: {
    onInvoiceReminderDue: mockFns.onInvoiceReminderDue,
  },
}));

vi.mock("@/modules/finance/repositories/InvoiceRepository", () => ({
  InvoiceRepository: class {
    findUnpaidInvoices = mockFns.findUnpaidInvoices;
  },
}));

import { BillingReminderService } from "@/modules/finance/services/BillingReminderService";

const REMINDER_SETTINGS = [
  { key: "GENERAL_REMINDER_OTOMATIS", value: "3" },
  { key: "GENERAL_REMINDER_FREQUENCY", value: "DAILY" },
  { key: "GENERAL_REMINDER_TIME", value: "08:00" },
  { key: "GENERAL_NOTIF_APP", value: "true" },
];

describe("BillingReminderService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.findManyByKeys.mockResolvedValue(REMINDER_SETTINGS);
    mockFns.findUnpaidInvoices.mockResolvedValue([]);
    mockFns.acquireCronLock.mockResolvedValue("acquired");
  });

  it("fires saat current time tepat di reminderTime (08:00:00)", async () => {
    const now = new Date("2026-05-22T08:00:00");
    await new BillingReminderService().sendDailyReminders(now);

    expect(mockFns.acquireCronLock).toHaveBeenCalledWith(
      "billing:reminder:daily:2026-05-22",
      expect.any(Number),
    );
    expect(mockFns.findUnpaidInvoices).toHaveBeenCalled();
  });

  it("masih fire saat cron telat 4 menit (08:04) — toleransi drift", async () => {
    const now = new Date("2026-05-22T08:04:30");
    await new BillingReminderService().sendDailyReminders(now);

    expect(mockFns.findUnpaidInvoices).toHaveBeenCalled();
  });

  it("tidak fire saat cron telat 5 menit (di luar window)", async () => {
    const now = new Date("2026-05-22T08:05:00");
    await new BillingReminderService().sendDailyReminders(now);

    expect(mockFns.acquireCronLock).not.toHaveBeenCalled();
    expect(mockFns.findUnpaidInvoices).not.toHaveBeenCalled();
  });

  it("tidak fire saat sebelum reminderTime (07:59)", async () => {
    const now = new Date("2026-05-22T07:59:30");
    await new BillingReminderService().sendDailyReminders(now);

    expect(mockFns.acquireCronLock).not.toHaveBeenCalled();
    expect(mockFns.findUnpaidInvoices).not.toHaveBeenCalled();
  });

  it("tidak fire ketika lock harian sudah dipegang (idempotency per hari)", async () => {
    mockFns.acquireCronLock.mockResolvedValue("locked");
    const now = new Date("2026-05-22T08:01:00");

    await new BillingReminderService().sendDailyReminders(now);

    expect(mockFns.findUnpaidInvoices).not.toHaveBeenCalled();
  });

  it("tidak fire ketika GENERAL_NOTIF_APP=false", async () => {
    mockFns.findManyByKeys.mockResolvedValue([
      ...REMINDER_SETTINGS.filter((s) => s.key !== "GENERAL_NOTIF_APP"),
      { key: "GENERAL_NOTIF_APP", value: "false" },
    ]);
    const now = new Date("2026-05-22T08:00:00");

    await new BillingReminderService().sendDailyReminders(now);

    expect(mockFns.acquireCronLock).not.toHaveBeenCalled();
    expect(mockFns.findUnpaidInvoices).not.toHaveBeenCalled();
  });

  it("emit reminder event untuk setiap unpaid invoice", async () => {
    mockFns.findUnpaidInvoices.mockResolvedValue([
      {
        id: "inv-1",
        pelangganId: "cust-1",
        dueDate: new Date("2026-05-25T00:00:00"),
        totalAmount: 100000n,
        paidAmount: 0n,
        invoiceNumber: "INV/2026/05/22-AAA",
        tenantId: "tenant-1",
      },
    ]);
    const now = new Date("2026-05-22T08:00:00");

    await new BillingReminderService().sendDailyReminders(now);

    expect(mockFns.onInvoiceReminderDue).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "inv-1",
        pelangganId: "cust-1",
        amountDue: 100000,
        reminderType: "UPCOMING",
        tenantId: "tenant-1",
      }),
    );
  });

  it("menolak reminderTime invalid", async () => {
    mockFns.findManyByKeys.mockResolvedValue([
      ...REMINDER_SETTINGS.filter((s) => s.key !== "GENERAL_REMINDER_TIME"),
      { key: "GENERAL_REMINDER_TIME", value: "abc" },
    ]);
    const now = new Date("2026-05-22T08:00:00");

    await new BillingReminderService().sendDailyReminders(now);

    expect(mockFns.acquireCronLock).not.toHaveBeenCalled();
    expect(mockFns.findUnpaidInvoices).not.toHaveBeenCalled();
  });
});
