import { describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getStatistics: vi.fn(),
  getSystemSummary: vi.fn(),
  getTopEmployees: vi.fn(),
  getTopProblematicSites: vi.fn(),
  getTopDismantleSites: vi.fn(),
  getTopInstallationSites: vi.fn(),
}));

vi.mock("@/modules/network/repositories/MikroTikRouterRepository", () => ({
  MikroTikRouterRepository: class MockMikroTikRouterRepository {
    getStatistics = mockFns.getStatistics;
  },
}));

vi.mock("@/modules/admin/services/DashboardService", () => ({
  DashboardService: class MockDashboardService {
    getSystemSummary = mockFns.getSystemSummary;
    getTopEmployees = mockFns.getTopEmployees;
    getTopProblematicSites = mockFns.getTopProblematicSites;
    getTopDismantleSites = mockFns.getTopDismantleSites;
    getTopInstallationSites = mockFns.getTopInstallationSites;
  },
  getDashboardService: () => ({
    getSystemSummary: mockFns.getSystemSummary,
    getTopEmployees: mockFns.getTopEmployees,
    getTopProblematicSites: mockFns.getTopProblematicSites,
    getTopDismantleSites: mockFns.getTopDismantleSites,
    getTopInstallationSites: mockFns.getTopInstallationSites,
  }),
}));

import { AdminDashboardComposer } from "@/modules/admin/services/dashboard/AdminDashboardComposer";

describe("AdminDashboardComposer", () => {
  it("meneruskan tenantId ke semua aggregate query dashboard", async () => {
    mockFns.getStatistics.mockResolvedValue({ total: 3 });
    mockFns.getSystemSummary.mockResolvedValue({ total: 1 });
    mockFns.getTopEmployees.mockResolvedValue([]);
    mockFns.getTopProblematicSites.mockResolvedValue([]);
    mockFns.getTopDismantleSites.mockResolvedValue([]);
    mockFns.getTopInstallationSites.mockResolvedValue([]);

    const composer = new AdminDashboardComposer();
    await composer.compose({
      tenantId: "tenant-1",
      viewerName: "Budi",
      now: new Date("2026-04-12T10:00:00.000Z"),
    });

    expect(mockFns.getStatistics).toHaveBeenCalledWith("tenant-1");
    expect(mockFns.getSystemSummary).toHaveBeenCalledWith({
      tenantId: "tenant-1",
    });
    expect(mockFns.getTopEmployees).toHaveBeenCalledWith({
      tenantId: "tenant-1",
    });
    expect(mockFns.getTopProblematicSites).toHaveBeenCalledWith({
      tenantId: "tenant-1",
    });
    expect(mockFns.getTopDismantleSites).toHaveBeenCalledWith({
      tenantId: "tenant-1",
    });
    expect(mockFns.getTopInstallationSites).toHaveBeenCalledWith({
      tenantId: "tenant-1",
    });
  });

  it("membuat leaderboard error tanpa menjatuhkan KPI ketika satu agregasi leaderboard gagal", async () => {
    mockFns.getStatistics.mockResolvedValue({ total: 3 });
    mockFns.getSystemSummary.mockResolvedValue({ total: 1 });
    mockFns.getTopEmployees.mockResolvedValue([]);
    mockFns.getTopProblematicSites.mockRejectedValue(new Error("boom"));
    mockFns.getTopDismantleSites.mockResolvedValue([]);
    mockFns.getTopInstallationSites.mockResolvedValue([]);

    const composer = new AdminDashboardComposer();
    const result = await composer.compose({
      tenantId: "tenant-1",
      viewerName: "Budi",
      now: new Date("2026-04-12T10:00:00.000Z"),
    });

    expect(result.kpis.state).toBe("ready");
    expect(result.leaderboards.state).toBe("error");
    expect(result.leaderboards.data).toBeNull();
    expect(result.leaderboards.message).toContain("leaderboard");
  });
});
