import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import { EVENT_NAMES } from "@/lib/event-bus";

const mockFindById = vi.hoisted(() => vi.fn());
const mockCountUnpaid = vi.hoisted(() => vi.fn());
const mockUpdateStatusPelanggan = vi.hoisted(() => vi.fn());

vi.mock("@/modules/finance", () => ({
  FinanceRepositoryFacade: {
    countUnpaidInvoicesForPelanggan: mockCountUnpaid,
  },
}));

vi.mock("@/modules/pelanggan/services/PelangganService", () => ({
  getPelangganService: () => ({
    updateStatusPelanggan: mockUpdateStatusPelanggan,
  }),
}));

vi.mock("@/modules/pelanggan/services/PelangganBillingBridgeService", () => ({
  PelangganBillingBridgeService: class {
    findById = mockFindById;
  },
}));

import { handleInvoicePaidActivation } from "@/modules/pelanggan/services/event-handlers/invoice-paid-activation.handler";

function buildJob(payload: Record<string, unknown>): Job {
  return {
    id: "job-1",
    data: {
      eventName: EVENT_NAMES.INVOICE_PAID,
      payload: { ...payload, timestamp: new Date().toISOString() },
    },
  } as unknown as Job;
}

describe("handleInvoicePaidActivation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aktifkan pelanggan ISOLIR tanpa unpaid invoice lain", async () => {
    mockFindById.mockResolvedValue({
      id: "pel-1",
      status: "ISOLIR",
      tipe: "REGULER",
    });
    mockCountUnpaid.mockResolvedValue(0);
    mockUpdateStatusPelanggan.mockResolvedValue({});

    await handleInvoicePaidActivation(
      buildJob({ invoiceId: "inv-1", pelangganId: "pel-1" }),
    );

    expect(mockUpdateStatusPelanggan).toHaveBeenCalledWith("pel-1", "AKTIF");
  });

  it("skip kalau pelanggan sudah AKTIF", async () => {
    mockFindById.mockResolvedValue({
      id: "pel-1",
      status: "AKTIF",
      tipe: "REGULER",
    });

    await handleInvoicePaidActivation(
      buildJob({ invoiceId: "inv-1", pelangganId: "pel-1" }),
    );

    expect(mockUpdateStatusPelanggan).not.toHaveBeenCalled();
  });

  it("skip kalau masih ada unpaid invoice lain (REGULER)", async () => {
    mockFindById.mockResolvedValue({
      id: "pel-1",
      status: "ISOLIR",
      tipe: "REGULER",
    });
    mockCountUnpaid.mockResolvedValue(2);

    await handleInvoicePaidActivation(
      buildJob({ invoiceId: "inv-1", pelangganId: "pel-1" }),
    );

    expect(mockUpdateStatusPelanggan).not.toHaveBeenCalled();
  });

  it("aktifkan pelanggan non-REGULER meskipun ada unpaid (bypass guard)", async () => {
    mockFindById.mockResolvedValue({
      id: "pel-1",
      status: "ISOLIR",
      tipe: "PRABAYAR",
    });

    await handleInvoicePaidActivation(
      buildJob({ invoiceId: "inv-1", pelangganId: "pel-1" }),
    );

    expect(mockUpdateStatusPelanggan).toHaveBeenCalledWith("pel-1", "AKTIF");
    expect(mockCountUnpaid).not.toHaveBeenCalled();
  });

  it("skip kalau pelanggan tidak ditemukan", async () => {
    mockFindById.mockResolvedValue(null);

    await handleInvoicePaidActivation(
      buildJob({ invoiceId: "inv-1", pelangganId: "pel-1" }),
    );

    expect(mockUpdateStatusPelanggan).not.toHaveBeenCalled();
  });

  it("throw kalau pelangganId bukan string", async () => {
    await expect(
      handleInvoicePaidActivation(
        buildJob({ invoiceId: "inv-1", pelangganId: 123 }),
      ),
    ).rejects.toThrow(/pelangganId/);
  });
});
