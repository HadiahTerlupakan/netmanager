import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import { EVENT_NAMES } from "@/lib/event-bus";

const { mockDispatch, mockInvoiceFindUnique } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockInvoiceFindUnique: vi.fn(),
}));

vi.mock("@/modules/notification", () => ({
  NotificationDispatcher: vi.fn().mockImplementation(function (this: {
    dispatch: typeof mockDispatch;
  }) {
    this.dispatch = mockDispatch;
  }),
}));

vi.mock("@/lib/prisma-billing", () => ({
  prismaBilling: {
    invoice: { findUnique: mockInvoiceFindUnique },
  },
}));

import { handleInvoiceNotification } from "@/modules/notification/services/event-handlers/invoice-notification.handler";

function buildJob(eventName: string, payload: Record<string, unknown>): Job {
  return {
    data: {
      eventName,
      payload: { ...payload, timestamp: new Date().toISOString() },
    },
  } as unknown as Job;
}

describe("InvoiceNotificationHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoiceFindUnique.mockResolvedValue({
      invoiceNumber: "INV/2026/001",
      dueDate: new Date("2026-06-01"),
    });
  });

  it("INVOICE_CREATED → dispatch invoiceCreated", async () => {
    await handleInvoiceNotification(
      buildJob(EVENT_NAMES.INVOICE_CREATED, {
        invoiceId: "inv-1",
        pelangganId: "cust-1",
        amount: 100000,
        invoiceNumber: "INV/2026/001",
        dueDate: "01/06/2026",
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "invoiceCreated",
        sourceType: "BILLING",
        sourceId: "inv-1",
      }),
    );
  });

  it("INVOICE_PAID → dispatch invoicePaid", async () => {
    await handleInvoiceNotification(
      buildJob(EVENT_NAMES.INVOICE_PAID, {
        invoiceId: "inv-1",
        pelangganId: "cust-1",
        amount: 100000,
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: "invoicePaid" }),
    );
  });

  // Checkout yang ditinggal dulu kedaluwarsa tanpa pemberitahuan apa pun.
  it("PAYMENT_FAILED → paymentExpired lewat in-app dan push saja", async () => {
    await handleInvoiceNotification(
      buildJob(EVENT_NAMES.PAYMENT_FAILED, {
        invoiceId: "inv-1",
        pelangganId: "cust-1",
        amount: 11100,
        dueDate: "2026-10-27T17:00:00.000Z",
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "paymentExpired",
        channels: ["inApp", "push"],
        params: expect.objectContaining({
          amountDue: 11100,
          invoiceNumber: "INV/2026/001",
        }),
      }),
    );
  });

  it("INVOICE_REMINDER_DUE → dispatch invoiceReminder dengan reminderType", async () => {
    await handleInvoiceNotification(
      buildJob(EVENT_NAMES.INVOICE_REMINDER_DUE, {
        invoiceId: "inv-1",
        pelangganId: "cust-1",
        invoiceNumber: "INV/2026/001",
        amountDue: 100000,
        dueDate: "01/06/2026",
        reminderType: "DUE_TODAY",
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "invoiceReminder",
        params: expect.objectContaining({ reminderType: "DUE_TODAY" }),
      }),
    );
  });

  it("INVOICE_OVERDUE → dispatch invoiceReminder dengan reminderType OVERDUE default", async () => {
    await handleInvoiceNotification(
      buildJob(EVENT_NAMES.INVOICE_OVERDUE, {
        invoiceId: "inv-1",
        pelangganId: "cust-1",
        amount: 100000,
        dueDate: "01/06/2026",
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "invoiceReminder",
        params: expect.objectContaining({ reminderType: "OVERDUE" }),
      }),
    );
  });

  it("fallback query DB kalau payload tidak include invoiceNumber/dueDate", async () => {
    await handleInvoiceNotification(
      buildJob(EVENT_NAMES.INVOICE_PAID, {
        invoiceId: "inv-1",
        pelangganId: "cust-1",
        amount: 100000,
      }),
    );
    expect(mockInvoiceFindUnique).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      select: { invoiceNumber: true, dueDate: true },
    });
  });

  it("tidak dispatch untuk event tidak dikenal", async () => {
    await handleInvoiceNotification(
      buildJob("billing:unknown", {
        invoiceId: "inv-1",
        pelangganId: "cust-1",
      }),
    );
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("throw ketika invoiceId bukan string", async () => {
    await expect(
      handleInvoiceNotification(
        buildJob(EVENT_NAMES.INVOICE_PAID, {
          invoiceId: 123,
          pelangganId: "cust-1",
        }),
      ),
    ).rejects.toThrow(/invoiceId/);
  });
});
