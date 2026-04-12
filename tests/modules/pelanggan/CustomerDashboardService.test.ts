import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerDashboardService } from "@/modules/pelanggan/services/dashboard/CustomerDashboardService";

describe("CustomerDashboardService", () => {
  const portalService = {
    getProfile: vi.fn(),
  };
  const usageService = {
    getUsageData: vi.fn(),
  };
  const invoiceRepository = {
    getDashboardBillingSummary: vi.fn(),
  };

  let service: CustomerDashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CustomerDashboardService({
      portalService,
      usageService,
      invoiceRepository,
    });
  });

  it("returns ready sections when all dashboard sources succeed", async () => {
    const profile = {
      id: "customer-1",
      idPelanggan: "PLG-001",
      nama: "Pelanggan 1",
      username: "pelanggan1",
      email: "user@example.com",
      noTelp: "08123456789",
      alamat: "Alamat",
      status: "ACTIVE",
      tipe: "residential",
      tanggalAktif: new Date("2024-01-01T00:00:00.000Z"),
      jatuhTempo: new Date("2024-02-10T00:00:00.000Z"),
      lokasi: {
        provinsi: "Jawa Barat",
        kabupatenKota: "Bandung",
        kecamatan: "Coblong",
        kelurahanDesa: "Dago",
      },
      preferences: {
        is2FAEnabled: true,
        isBillNotifEnabled: true,
        isPromoEnabled: false,
      },
      paket: null as null,
    };
    const connection = {
      connection: {
        isOnline: true,
        ipAddress: "10.0.0.1",
        nasipaddress: "10.0.0.2",
        sessionId: "session-1",
        sessionStart: new Date("2024-01-02T00:00:00.000Z"),
        sessionDuration: 3600,
        sessionDurationFormatted: "1j 0m",
        lastSeen: new Date("2024-01-02T01:00:00.000Z"),
      },
      usage: {
        monthly: {
          download: { bytes: 1024, formatted: "1 KB" },
          upload: { bytes: 2048, formatted: "2 KB" },
          total: { bytes: 3072, formatted: "3 KB" },
          period: {
            start: new Date("2024-01-01T00:00:00.000Z"),
            end: new Date("2024-01-31T23:59:59.000Z"),
          },
        },
        allTime: {
          download: { bytes: 4096, formatted: "4 KB" },
          upload: { bytes: 8192, formatted: "8 KB" },
          total: { bytes: 12288, formatted: "12 KB" },
        },
      },
    };

    portalService.getProfile.mockResolvedValue(profile);
    usageService.getUsageData.mockResolvedValue(connection);
    invoiceRepository.getDashboardBillingSummary.mockResolvedValue({
      outstandingCount: 3,
      outstandingAmount: 150000,
      nearestDueDate: "2024-02-10T00:00:00.000Z",
      hasOverdue: true,
    });

    const result = await service.getDashboardData({ customerId: "customer-1" });

    expect(portalService.getProfile).toHaveBeenCalledWith("customer-1");
    expect(usageService.getUsageData).toHaveBeenCalledWith("customer-1");
    expect(invoiceRepository.getDashboardBillingSummary).toHaveBeenCalledWith(
      "customer-1",
    );
    expect(result.profile).toEqual({
      state: "ready",
      data: profile,
    });
    expect(result.connection).toEqual({
      state: "ready",
      data: connection.connection,
    });
    expect(result.billing).toEqual({
      state: "ready",
      data: {
        outstandingCount: 3,
        outstandingAmount: 150000,
        nearestDueDate: "2024-02-10T00:00:00.000Z",
        hasOverdue: true,
      },
    });
  });

  it("keeps other sections ready when profile section fails", async () => {
    usageService.getUsageData.mockResolvedValue({
      connection: {
        isOnline: false,
        ipAddress: null,
        nasipaddress: null,
        sessionId: null,
        sessionStart: null,
        sessionDuration: 0,
        sessionDurationFormatted: null,
        lastSeen: null,
      },
      usage: {
        monthly: {
          download: { bytes: 0, formatted: "0 B" },
          upload: { bytes: 0, formatted: "0 B" },
          total: { bytes: 0, formatted: "0 B" },
          period: {
            start: new Date("2024-01-01T00:00:00.000Z"),
            end: new Date("2024-01-31T23:59:59.000Z"),
          },
        },
        allTime: {
          download: { bytes: 0, formatted: "0 B" },
          upload: { bytes: 0, formatted: "0 B" },
          total: { bytes: 0, formatted: "0 B" },
        },
      },
    });
    invoiceRepository.getDashboardBillingSummary.mockResolvedValue({
      outstandingCount: 0,
      outstandingAmount: 0,
      nearestDueDate: null,
      hasOverdue: false,
    });
    portalService.getProfile.mockRejectedValue(new Error("profile failed"));

    const result = await service.getDashboardData({ customerId: "customer-2" });

    expect(result.profile).toEqual({
      state: "error",
      data: null,
      message: "profile failed",
    });
    expect(result.connection).toEqual({
      state: "ready",
      data: {
        isOnline: false,
        ipAddress: null,
        nasipaddress: null,
        sessionId: null,
        sessionStart: null,
        sessionDuration: 0,
        sessionDurationFormatted: null,
        lastSeen: null,
      },
    });
    expect(result.billing).toEqual({
      state: "ready",
      data: {
        outstandingCount: 0,
        outstandingAmount: 0,
        nearestDueDate: null,
        hasOverdue: false,
      },
    });
  });
});
