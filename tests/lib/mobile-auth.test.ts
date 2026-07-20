import { beforeEach, describe, expect, it, vi } from "vitest";

const mockJwtVerify = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockPelangganFindUnique = vi.hoisted(() => vi.fn());
const mockMitraFindUnique = vi.hoisted(() => vi.fn());

vi.mock("jose", () => ({
  jwtVerify: mockJwtVerify,
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return "signed-token";
    }
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
    pelanggan: {
      findUnique: mockPelangganFindUnique,
    },
  },
  prismaAuth: {
    user: {
      findUnique: mockUserFindUnique,
    },
    pelanggan: {
      findUnique: mockPelangganFindUnique,
    },
  },
}));

vi.mock("@/lib/prisma-mitra", () => ({
  prismaMitra: {
    mitra: {
      findUnique: mockMitraFindUnique,
    },
  },
  prismaMitraAuth: {
    mitra: {
      findUnique: mockMitraFindUnique,
    },
  },
}));

import {
  getMitraMobileCapabilities,
  getMobileTokenDetails,
  hasAnyMobilePermission,
  hasMobilePermission,
  verifyMobileRefreshToken,
  verifyMobileToken,
} from "@/lib/mobile-auth";

describe("mobile-auth version overrides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockResolvedValue(null);
    mockPelangganFindUnique.mockResolvedValue(null);
    mockMitraFindUnique.mockResolvedValue(null);
  });

  it("uses explicit version override when it is lower than or equal to token claim", async () => {
    // Source of truth: claim `appVersionCode` di JWT (signed saat login).
    // Header `X-App-Version-Code` HANYA diterima sebagai upper-bound
    // override (≤ token claim), agar attacker tidak bisa spoof header
    // dengan versi lebih TINGGI untuk bypass version gating.
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: "user-1", tokenVersion: 1, appVersionCode: 100 },
    });

    const details = await getMobileTokenDetails("token-1", 80);

    // Header (80) ≤ token (100) → header dipercaya (kasus user downgrade
    // runtime sambil token masih valid, backend perlu tahu versi runtime
    // sebenarnya untuk gating).
    expect(details?.versionCode).toBe(80);
  });

  it("ignores version override when it claims a higher version than token (anti-spoof)", async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: "user-1", tokenVersion: 1, appVersionCode: 54 },
    });

    const details = await getMobileTokenDetails("token-1", 100);

    // Header (100) > token claim (54) → spoof attempt, ignore.
    expect(details?.versionCode).toBe(54);
  });

  it("accepts a supported request version even when token appVersionCode is stale", async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: "user-1", tokenVersion: 2, appVersionCode: 54 },
    });
    mockUserFindUnique.mockResolvedValueOnce({
      tokenVersion: 2,
      isActive: true,
      isSales: false,
      siteId: null,
      tenantId: "tenant-1",
      userSites: [],
      role: {
        name: "ADMIN",
        isSuperAdmin: false,
        permission: [],
      },
    });

    const payload = await verifyMobileToken("token-1", 100);

    expect(payload?.userId).toBe("user-1");
    expect(payload?.siteIds).toEqual([]);
  });

  it("builds Mitra teknisi capabilities from the centralized helper", () => {
    const capabilities = getMitraMobileCapabilities("MITRA_TEKNISI");

    expect(capabilities.features).toEqual([
      "m_dashboard",
      "m_mitra_wallet",
      "m_mitra_withdraw",
      "m_chat",
      "m_work_order",
      "m_barang",
      "m_barang_masuk",
      "m_barang_keluar",
    ]);
    expect(capabilities.permissions).toEqual(
      expect.arrayContaining([
        "m_dashboard:read",
        "m_chat:read",
        "m_chat:create",
        "m_work_order:read",
        "m_work_order:update",
        "m_work_order:create",
        "m_barang:read",
        "m_barang_masuk:read",
        "m_barang_masuk:create",
        "m_barang_keluar:read",
        "m_barang_keluar:create",
      ]),
    );
  });

  it("returns Mitra permission snapshot from verifyMobileToken", async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: { sub: "mitra-1", tokenVersion: 1, appVersionCode: 100 },
    });
    mockMitraFindUnique.mockResolvedValueOnce({
      id: "mitra-1",
      name: "Mitra Teknisi",
      isActive: true,
      mitraType: "MITRA_TEKNISI",
      siteId: "site-1",
      tenantId: "tenant-1",
    });

    const payload = await verifyMobileToken("token-1", 100);

    expect(payload?.role).toBe("MITRA");
    expect(payload?.permissions).toEqual(
      getMitraMobileCapabilities("MITRA_TEKNISI").permissions,
    );
    expect(payload?.permissions).toContain("m_work_order:read");
    expect(payload?.permissions).toContain("m_work_order:update");
    expect(payload?.permissions).toContain("m_chat:read");
    expect(payload?.permissions).toContain("m_chat:create");
    expect(payload?.permissions).toContain("m_barang_masuk:create");
  });

  it("returns wildcard permission for super admin mobile tokens", async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        sub: "admin-1",
        tokenVersion: 3,
        type: "access",
        appVersionCode: 100,
      },
    });
    mockUserFindUnique.mockResolvedValueOnce({
      tokenVersion: 3,
      isActive: true,
      isSales: false,
      siteId: "site-1",
      tenantId: "tenant-1",
      userSites: [{ siteId: "site-1" }, { siteId: "site-2" }],
      role: {
        name: "SUPER_ADMIN",
        isSuperAdmin: true,
        permission: [],
      },
    });

    const payload = await verifyMobileToken("token-1", 100);

    expect(payload?.permissions).toEqual(["*"]);
    expect(payload?.isSuperAdmin).toBe(true);
    expect(payload?.siteIds).toEqual(["site-1", "site-2"]);
    expect(
      hasMobilePermission(payload?.permissions, "m_barang_keluar:create"),
    ).toBe(true);
    expect(
      hasAnyMobilePermission(payload?.permissions, ["m_barang:read"]),
    ).toBe(true);
  });

  it("rejects access verification for refresh tokens", async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        sub: "user-1",
        tokenVersion: 1,
        type: "refresh",
        appVersionCode: 100,
      },
    });

    const payload = await verifyMobileToken("token-1", 100);

    expect(payload).toBeNull();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("accepts refresh verification for refresh tokens", async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        sub: "user-1",
        tokenVersion: 1,
        type: "refresh",
        appVersionCode: 100,
      },
    });
    mockUserFindUnique.mockResolvedValueOnce({
      tokenVersion: 1,
      isActive: true,
      isSales: false,
      siteId: null,
      tenantId: "tenant-1",
      userSites: [],
      role: {
        name: "ADMIN",
        isSuperAdmin: false,
        permission: [],
      },
    });

    const payload = await verifyMobileRefreshToken("token-1", 100);

    expect(payload?.userId).toBe("user-1");
    expect(payload?.siteIds).toEqual([]);
    expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
  });
});

describe("mobile-auth permission aliases", () => {
  it("accepts bare feature aliases for permission-style checks", () => {
    expect(
      hasMobilePermission(["m_barang_masuk"], "m_barang_masuk:create"),
    ).toBe(true);
    expect(
      hasMobilePermission(["m_barang_keluar"], "m_barang_keluar:create"),
    ).toBe(true);
  });
});
