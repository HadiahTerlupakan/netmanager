import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import { handleCustomerStatusEvent } from "@/modules/network/services/event-handlers/customer-status.handler";
import { EVENT_NAMES } from "@/lib/event-bus";

const mockHandleStatusChange = vi.fn();
const mockSyncSingleCustomer = vi.fn();
const mockRemoveCustomer = vi.fn();

vi.mock("@/modules/network/services/radius-sync-service", () => {
  const MockRadiusSyncService = vi.fn(function (this: unknown) {
    (this as Record<string, unknown>).handleStatusChange =
      mockHandleStatusChange;
    (this as Record<string, unknown>).syncSingleCustomer =
      mockSyncSingleCustomer;
    (this as Record<string, unknown>).removeCustomer = mockRemoveCustomer;
  });
  return { RadiusSyncService: MockRadiusSyncService };
});

function buildJob(eventName: string, payload: Record<string, unknown>): Job {
  return {
    data: {
      eventName,
      payload: { ...payload, timestamp: new Date().toISOString() },
    },
  } as unknown as Job;
}

describe("CustomerStatusEventHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("CUSTOMER_ISOLATED memicu handleStatusChange dengan status ISOLIR", async () => {
    const job = buildJob(EVENT_NAMES.CUSTOMER_ISOLATED, {
      customerId: "cust-1",
      customerName: "Budi",
      oldStatus: "AKTIF",
      newStatus: "ISOLIR",
    });
    await handleCustomerStatusEvent(job);
    expect(mockHandleStatusChange).toHaveBeenCalledWith("cust-1", "ISOLIR");
  });

  it("CUSTOMER_ACTIVATED memicu handleStatusChange dengan status AKTIF", async () => {
    const job = buildJob(EVENT_NAMES.CUSTOMER_ACTIVATED, {
      customerId: "cust-1",
      customerName: "Budi",
      oldStatus: "ISOLIR",
      newStatus: "AKTIF",
    });
    await handleCustomerStatusEvent(job);
    expect(mockHandleStatusChange).toHaveBeenCalledWith("cust-1", "AKTIF");
  });

  it("CUSTOMER_SUSPENDED memicu handleStatusChange dengan status NONAKTIF", async () => {
    const job = buildJob(EVENT_NAMES.CUSTOMER_SUSPENDED, {
      customerId: "cust-1",
      customerName: "Budi",
      oldStatus: "AKTIF",
      newStatus: "NONAKTIF",
    });
    await handleCustomerStatusEvent(job);
    expect(mockHandleStatusChange).toHaveBeenCalledWith("cust-1", "NONAKTIF");
  });

  it("CUSTOMER_CREATED memicu syncSingleCustomer", async () => {
    const job = buildJob(EVENT_NAMES.CUSTOMER_CREATED, {
      customerId: "cust-1",
      customerName: "Budi",
    });
    await handleCustomerStatusEvent(job);
    expect(mockSyncSingleCustomer).toHaveBeenCalledWith("cust-1");
  });

  it("CUSTOMER_UPDATED memicu syncSingleCustomer", async () => {
    const job = buildJob(EVENT_NAMES.CUSTOMER_UPDATED, {
      customerId: "cust-1",
      customerName: "Budi",
    });
    await handleCustomerStatusEvent(job);
    expect(mockSyncSingleCustomer).toHaveBeenCalledWith("cust-1");
  });

  it("CUSTOMER_DELETED memicu removeCustomer dengan username", async () => {
    const job = buildJob(EVENT_NAMES.CUSTOMER_DELETED, {
      customerId: "cust-1",
      username: "budi123",
    });
    await handleCustomerStatusEvent(job);
    expect(mockRemoveCustomer).toHaveBeenCalledWith("budi123", undefined);
  });

  it("CUSTOMER_DELETED meneruskan tenantId ke removeCustomer", async () => {
    const job = buildJob(EVENT_NAMES.CUSTOMER_DELETED, {
      customerId: "cust-1",
      username: "budi123",
      tenantId: "tenant-xyz",
    });
    await handleCustomerStatusEvent(job);
    expect(mockRemoveCustomer).toHaveBeenCalledWith("budi123", "tenant-xyz");
  });

  it("melempar error ketika payload.customerId bukan string", async () => {
    const job = buildJob(EVENT_NAMES.CUSTOMER_ISOLATED, {
      customerId: 12345,
      customerName: "Budi",
      oldStatus: "AKTIF",
      newStatus: "ISOLIR",
    });
    await expect(handleCustomerStatusEvent(job)).rejects.toThrow(/customerId/);
  });

  it("melempar error ketika payload.newStatus kosong", async () => {
    const job = buildJob(EVENT_NAMES.CUSTOMER_ACTIVATED, {
      customerId: "cust-1",
      customerName: "Budi",
      oldStatus: "ISOLIR",
      newStatus: "",
    });
    await expect(handleCustomerStatusEvent(job)).rejects.toThrow(/newStatus/);
  });

  it("melempar error supaya BullMQ retry ketika MikroTik sync gagal", async () => {
    mockHandleStatusChange.mockRejectedValueOnce(new Error("MikroTik timeout"));
    const job = buildJob(EVENT_NAMES.CUSTOMER_ISOLATED, {
      customerId: "cust-1",
      customerName: "Budi",
      oldStatus: "AKTIF",
      newStatus: "ISOLIR",
    });
    await expect(handleCustomerStatusEvent(job)).rejects.toThrow(
      "MikroTik timeout",
    );
  });

  it("mengabaikan event yang tidak dikenal tanpa throw", async () => {
    const job = buildJob("customer:unknown", {
      customerId: "cust-1",
    });
    await expect(handleCustomerStatusEvent(job)).resolves.not.toThrow();
    expect(mockHandleStatusChange).not.toHaveBeenCalled();
    expect(mockSyncSingleCustomer).not.toHaveBeenCalled();
    expect(mockRemoveCustomer).not.toHaveBeenCalled();
  });
});
