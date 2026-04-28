import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getMobileAuthPayload: vi.fn(),
  getMobileEmployeeMe: vi.fn(),
  mitraFindUnique: vi.fn(),
  getUserFeaturesWithCanvasing: vi.fn(),
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockFns.getMobileAuthPayload,
}));

vi.mock("@/modules/users", () => ({
  getMobileEmployeeMe: mockFns.getMobileEmployeeMe,
  UserLookupService: class MockUserLookupService {},
}));

vi.mock("@/modules/database", () => ({
  prisma: {},
  prismaMitra: {
    mitra: {
      findUnique: mockFns.mitraFindUnique,
    },
  },
}));

vi.mock("@/modules/marketing", () => ({
  getUserFeaturesWithCanvasing: mockFns.getUserFeaturesWithCanvasing,
}));

import { GET } from "@/app/api/mobile/auth/me/route";

describe("mobile auth me route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns resource-level features for employee payloads", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      role: "ADMIN",
    });
    mockFns.getMobileEmployeeMe.mockResolvedValue({
      id: "user-1",
      name: "Admin One",
      email: "admin@example.com",
      image: null,
      isActive: true,
      employeeType: "KARYAWAN",
    });
    mockFns.getUserFeaturesWithCanvasing.mockResolvedValue([
      "m_dashboard",
      "m_barang",
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/mobile/auth/me"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.features).toEqual(["m_dashboard", "m_barang"]);
  });

  it("returns centralized Mitra teknisi features", async () => {
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "mitra-1",
      tenantId: "tenant-1",
      role: "MITRA",
    });
    mockFns.mitraFindUnique.mockResolvedValue({
      id: "mitra-1",
      name: "Mitra Teknisi",
      email: "mitra@example.com",
      isActive: true,
      mitraType: "MITRA_TEKNISI",
      phone: "08123",
      siteId: "site-1",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/mobile/auth/me"),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.features).toEqual([
      "m_dashboard",
      "m_mitra_wallet",
      "m_mitra_withdraw",
      "m_work_order",
      "m_barang",
      "m_barang_masuk",
      "m_barang_keluar",
    ]);
  });
});
