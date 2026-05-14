import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  mitraFindFirst: vi.fn(),
  siteFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
  leaveFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  getMitraMobileFeatures: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    sites: { findFirst: mockFns.siteFindFirst },
    user: {
      findFirst: mockFns.userFindFirst,
      update: mockFns.userUpdate,
    },
    leaveRequest: { findFirst: mockFns.leaveFindFirst },
  },
  prismaMitra: {
    mitra: { findFirst: mockFns.mitraFindFirst },
  },
}));

vi.mock("@/lib/mobile-auth", () => ({
  getMitraMobileFeatures: mockFns.getMitraMobileFeatures,
}));

vi.mock("@/modules/marketing", () => ({
  extractMobileFeaturesFromPermissions: (permissions: { resource: string }[]) =>
    permissions.map((p) => p.resource).filter((r) => r.startsWith("m_")),
}));

import {
  getMobileProfileForRoute,
  updateMobileProfileForRoute,
} from "@/modules/users/services/MobileProfileRouteService";

describe("MobileProfileRouteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mitra profile with site and feature metadata", async () => {
    mockFns.mitraFindFirst.mockResolvedValue({
      id: "mitra-1",
      name: "Mitra",
      email: "m@example.com",
      phone: "08123",
      fotoDiri: "photo.jpg",
      nik: "123",
      createdAt: new Date("2026-04-01T00:00:00Z"),
      mitraType: "MITRA_SALES",
      requiresFaceVerification: true,
      siteId: "site-1",
    });
    mockFns.siteFindFirst.mockResolvedValue({ id: "site-1", name: "Site A" });
    mockFns.getMitraMobileFeatures.mockReturnValue(["sales"]);

    await expect(
      getMobileProfileForRoute({
        id: "mitra-1",
        role: "MITRA",
        tenantId: "tenant-1",
      }),
    ).resolves.toMatchObject({
      id: "mitra-1",
      role: { id: "mitra", name: "MITRA" },
      sites: [{ id: "site-1", name: "Site A" }],
      features: ["sales"],
      isOnLeave: false,
    });
  });

  it("returns regular user profile with leave flag", async () => {
    mockFns.userFindFirst.mockResolvedValue({
      id: "user-1",
      name: "User",
      role: {
        id: "role-1",
        name: "ADMIN",
        permission: [{ resource: "m_attendance", action: "read" }],
      },
    });
    mockFns.leaveFindFirst.mockResolvedValue({ id: "leave-1" });

    await expect(
      getMobileProfileForRoute({
        id: "user-1",
        role: "ADMIN",
        tenantId: "tenant-1",
      }),
    ).resolves.toMatchObject({
      id: "user-1",
      features: ["m_attendance"],
      isOnLeave: true,
    });
  });

  it("updates regular user mobile profile fields", async () => {
    mockFns.userUpdate.mockResolvedValue({ id: "user-1", name: "Updated" });

    await expect(
      updateMobileProfileForRoute({
        user: { id: "user-1", tenantId: "tenant-1" },
        input: { name: "Updated" },
      }),
    ).resolves.toEqual({ id: "user-1", name: "Updated" });
  });
});
