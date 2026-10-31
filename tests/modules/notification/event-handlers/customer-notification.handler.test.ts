import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import { EVENT_NAMES } from "@/lib/event-bus";

const mockDispatch = vi.fn();
vi.mock("@/modules/notification", () => ({
  NotificationDispatcher: vi.fn().mockImplementation(function (this: {
    dispatch: typeof mockDispatch;
  }) {
    this.dispatch = mockDispatch;
  }),
}));

import { handleCustomerNotification } from "@/modules/notification/services/event-handlers/customer-notification.handler";

function buildJob(eventName: string, payload: Record<string, unknown>): Job {
  return {
    data: {
      eventName,
      payload: { ...payload, timestamp: new Date().toISOString() },
    },
  } as unknown as Job;
}

describe("CustomerNotificationHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("CUSTOMER_CREATED → dispatch customerWelcome", async () => {
    await handleCustomerNotification(
      buildJob(EVENT_NAMES.CUSTOMER_CREATED, {
        customerId: "cust-1",
        customerName: "Budi",
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "customerWelcome",
        pelangganId: "cust-1",
      }),
    );
  });

  it("CUSTOMER_ISOLATED dengan tunggakan → customerIsolated berikut tagihannya", async () => {
    await handleCustomerNotification(
      buildJob(EVENT_NAMES.CUSTOMER_ISOLATED, {
        customerId: "cust-1",
        customerName: "Budi",
        oldStatus: "AKTIF",
        newStatus: "ISOLIR",
        arrearsInvoiceNumber: "INV/2026/10/0001",
        arrearsAmount: 150000,
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "customerIsolated",
        params: expect.objectContaining({
          invoiceNumber: "INV/2026/10/0001",
          amountDue: 150000,
        }),
      }),
    );
  });

  // Admin mengisolir pelanggan yang tidak punya tagihan lewat jatuh tempo:
  // pesan "karena tunggakan" dulu tetap terkirim dan menuduh pelanggan
  // menunggak.
  it("CUSTOMER_ISOLATED tanpa tunggakan → customerIsolatedByAdmin", async () => {
    await handleCustomerNotification(
      buildJob(EVENT_NAMES.CUSTOMER_ISOLATED, {
        customerId: "cust-1",
        customerName: "Budi",
        oldStatus: "AKTIF",
        newStatus: "ISOLIR",
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: "customerIsolatedByAdmin" }),
    );
  });

  it.each([
    ["NONAKTIF", "customerDeactivated"],
    ["MAINTENANCE", "customerMaintenance"],
    ["DISMANTLE", "customerDismantled"],
  ])(
    "CUSTOMER_SUSPENDED ke %s → dispatch %s",
    async (newStatus, templateKey) => {
      await handleCustomerNotification(
        buildJob(EVENT_NAMES.CUSTOMER_SUSPENDED, {
          customerId: "cust-1",
          customerName: "Budi",
          oldStatus: "AKTIF",
          newStatus,
        }),
      );
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ templateKey, pelangganId: "cust-1" }),
      );
    },
  );

  it("CUSTOMER_SUSPENDED dengan status tak dikenal → tidak dispatch", async () => {
    await handleCustomerNotification(
      buildJob(EVENT_NAMES.CUSTOMER_SUSPENDED, {
        customerId: "cust-1",
        customerName: "Budi",
        oldStatus: "AKTIF",
        newStatus: "LAINNYA",
      }),
    );
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("CUSTOMER_ACTIVATED → dispatch customerActivated", async () => {
    await handleCustomerNotification(
      buildJob(EVENT_NAMES.CUSTOMER_ACTIVATED, {
        customerId: "cust-1",
        customerName: "Budi",
        oldStatus: "ISOLIR",
        newStatus: "AKTIF",
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: "customerActivated" }),
    );
  });

  it("event tidak dikenal → tidak dispatch", async () => {
    await handleCustomerNotification(
      buildJob("customer:unknown", { customerId: "cust-1" }),
    );
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("throw ketika customerId bukan string", async () => {
    await expect(
      handleCustomerNotification(
        buildJob(EVENT_NAMES.CUSTOMER_CREATED, { customerId: 123 }),
      ),
    ).rejects.toThrow(/customerId/);
  });
});
