import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../setup";
import { ProfilePPPService } from "@/modules/network/services/ProfilePPPService";

const mockFns = vi.hoisted(() => ({
  createPPPProfileInMikroTik: vi.fn(),
  updatePPPProfileInMikroTik: vi.fn(),
  deletePPPProfileInMikroTik: vi.fn(),
  getRateLimitFromBandwidth: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/network/services/mikrotik-ppp-profile", () => ({
  createPPPProfileInMikroTik: mockFns.createPPPProfileInMikroTik,
  updatePPPProfileInMikroTik: mockFns.updatePPPProfileInMikroTik,
  deletePPPProfileInMikroTik: mockFns.deletePPPProfileInMikroTik,
  getRateLimitFromBandwidth: mockFns.getRateLimitFromBandwidth,
}));

describe("ProfilePPPService deleteProfilePPPFromRequest", () => {
  let service: ProfilePPPService;
  const session = {
    user: {
      id: "admin-1",
      role: "ADMIN",
      permissions: ["profileppp:delete"],
      siteId: "site-1",
      tenantId: "tenant-1",
    },
  } as unknown as Session;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProfilePPPService();
    mockFns.getRateLimitFromBandwidth.mockResolvedValue(null);
  });

  it("mengembalikan 401 saat session tidak ada", async () => {
    const result = await service.deleteProfilePPPFromRequest({
      session: null,
      id: "profile-1",
    });

    expect(result).toEqual({
      success: false,
      status: 401,
      error: "Autentikasi diperlukan",
    });
    expect(prismaMock.profilePPP.findUnique).not.toHaveBeenCalled();
  });

  it("mengembalikan 403 saat user tidak punya permission delete", async () => {
    const sessionWithoutDeletePermission = {
      user: {
        id: "admin-1",
        role: "ADMIN",
        permissions: [],
        siteId: "site-1",
        tenantId: "tenant-1",
      },
    } as unknown as Session;

    const result = await service.deleteProfilePPPFromRequest({
      session: sessionWithoutDeletePermission,
      id: "profile-1",
    });

    expect(result).toEqual({
      success: false,
      status: 403,
      error: "Akses ditolak",
    });
    expect(prismaMock.profilePPP.findUnique).not.toHaveBeenCalled();
  });

  it("mengembalikan 404 saat profile tidak ditemukan", async () => {
    prismaMock.profilePPP.findUnique.mockResolvedValue(null);

    const result = await service.deleteProfilePPPFromRequest({
      session,
      id: "profile-1",
    });

    expect(result).toEqual({
      success: false,
      status: 404,
      error: "Profile PPP tidak ditemukan",
    });
    expect(prismaMock.profilePPP.delete).not.toHaveBeenCalled();
    expect(mockFns.deletePPPProfileInMikroTik).not.toHaveBeenCalled();
  });

  it("menolak delete saat profile masih dipakai paket", async () => {
    prismaMock.profilePPP.findUnique.mockResolvedValue({
      id: "profile-1",
      name: "PROFILE-1",
      remoteAddress: "POOL-1",
      siteId: "site-1",
      mikroTikRouterId: "router-1",
      mikroTikRouter: {
        id: "router-1",
        name: "Router 1",
      },
      hargaPaket: [
        { id: "paket-1", name: "Paket 10M" },
        { id: "paket-2", name: "Paket 20M" },
      ],
    });

    const result = await service.deleteProfilePPPFromRequest({
      session,
      id: "profile-1",
    });

    expect(result.success).toBe(false);
    if (result.success !== false) {
      throw new Error("expected failed result");
    }
    expect(result.status).toBe(400);
    expect(result.error).toContain("PROFILE-1");
    expect(result.error).toContain("masih digunakan");
    expect(result.error).toContain("Paket 10M, Paket 20M");
    expect(prismaMock.profilePPP.delete).not.toHaveBeenCalled();
    expect(mockFns.deletePPPProfileInMikroTik).not.toHaveBeenCalled();
  });

  it("mengembalikan 403 saat profile berada di site lain untuk user site-only", async () => {
    const restrictedSession = {
      user: {
        id: "admin-1",
        role: "ADMIN",
        permissions: ["profileppp:delete", "profileppp:site_only"],
        siteId: "site-1",
        tenantId: "tenant-1",
      },
    } as unknown as Session;

    prismaMock.profilePPP.findUnique.mockResolvedValue({
      id: "profile-1",
      name: "PROFILE-1",
      remoteAddress: "POOL-1",
      siteId: "site-2",
      mikroTikRouterId: "router-1",
      mikroTikRouter: {
        id: "router-1",
        name: "Router 1",
      },
      hargaPaket: [],
    });

    const result = await service.deleteProfilePPPFromRequest({
      session: restrictedSession,
      id: "profile-1",
    });

    expect(result).toEqual({
      success: false,
      status: 403,
      error: "Anda tidak memiliki akses ke profile PPP di site ini",
    });
    expect(prismaMock.profilePPP.delete).not.toHaveBeenCalled();
    expect(mockFns.deletePPPProfileInMikroTik).not.toHaveBeenCalled();
  });

  it("mengembalikan 502 saat cleanup MikroTik gagal", async () => {
    prismaMock.profilePPP.findUnique.mockResolvedValue({
      id: "profile-1",
      name: "PROFILE-1",
      remoteAddress: "POOL-1",
      siteId: "site-1",
      mikroTikRouterId: "router-1",
      mikroTikRouter: {
        id: "router-1",
        name: "Router 1",
      },
      hargaPaket: [],
    });
    mockFns.deletePPPProfileInMikroTik.mockResolvedValue({
      success: false,
      error: "router timeout",
    });

    const result = await service.deleteProfilePPPFromRequest({
      session,
      id: "profile-1",
    });

    expect(result).toEqual({
      success: false,
      status: 502,
      error: "router timeout",
    });
    expect(prismaMock.profilePPP.delete).not.toHaveBeenCalled();
  });

  it("mengembalikan 502 saat cleanup MikroTik melempar error", async () => {
    prismaMock.profilePPP.findUnique.mockResolvedValue({
      id: "profile-1",
      name: "PROFILE-1",
      remoteAddress: "POOL-1",
      siteId: "site-1",
      mikroTikRouterId: "router-1",
      mikroTikRouter: {
        id: "router-1",
        name: "Router 1",
      },
      hargaPaket: [],
    });
    mockFns.deletePPPProfileInMikroTik.mockRejectedValue(
      new Error("router meledak"),
    );

    const result = await service.deleteProfilePPPFromRequest({
      session,
      id: "profile-1",
    });

    expect(result).toEqual({
      success: false,
      status: 502,
      error: "router meledak",
    });
    expect(prismaMock.profilePPP.delete).not.toHaveBeenCalled();
  });

  it("menghapus database setelah cleanup MikroTik sukses", async () => {
    prismaMock.profilePPP.findUnique.mockResolvedValue({
      id: "profile-1",
      name: "PROFILE-1",
      remoteAddress: "POOL-1",
      siteId: "site-1",
      mikroTikRouterId: "router-1",
      mikroTikRouter: {
        id: "router-1",
        name: "Router 1",
      },
      hargaPaket: [],
    });
    mockFns.deletePPPProfileInMikroTik.mockResolvedValue({
      success: true,
    });

    const result = await service.deleteProfilePPPFromRequest({
      session,
      id: "profile-1",
    });

    expect(mockFns.deletePPPProfileInMikroTik).toHaveBeenCalledWith(
      "router-1",
      "PROFILE-1",
      "POOL-1",
    );
    expect(prismaMock.profilePPP.delete).toHaveBeenCalledWith({
      where: { id: "profile-1" },
    });
    expect(result).toEqual({
      success: true,
      message: "Profile PPP berhasil dihapus",
    });
  });
});
