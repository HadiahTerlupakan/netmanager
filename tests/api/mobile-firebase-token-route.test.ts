import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMobileAuthPayload: vi.fn(),
  createCustomToken: vi.fn(),
  setCustomUserClaims: vi.fn(),
  advancedRateLimit: vi.fn(),
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mocks.getMobileAuthPayload,
}));

vi.mock("@/lib/firebase/admin", () => ({
  auth: {
    createCustomToken: mocks.createCustomToken,
    setCustomUserClaims: mocks.setCustomUserClaims,
  },
}));

vi.mock("@/lib/middleware/advanced-rate-limit", () => ({
  advancedRateLimit: mocks.advancedRateLimit,
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdminRole: (role: string) =>
    role === "SUPER_ADMIN" || role === "Super Admin",
}));

import { POST } from "@/app/api/mobile/auth/firebase-token/route";

const request = () =>
  new NextRequest("https://app.example.test/api/mobile/auth/firebase-token", {
    method: "POST",
  });

/**
 * Aturan Firestore membuka event tiket dan work order se-tenant kepada token
 * yang `tenantId`-nya cocok. Pelanggan di aplikasi dulu mendapat klaim
 * berbentuk staf (ber-tenant, `accessEmployeePanel: true`) yang juga disimpan
 * di akun Firebase-nya; kini klaimnya klaim pelanggan saja, dan yang tersimpan
 * ikut diganti.
 */
describe("mobile firebase token route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.advancedRateLimit.mockResolvedValue(null);
    mocks.setCustomUserClaims.mockResolvedValue(undefined);
    mocks.createCustomToken.mockResolvedValue("mobile-custom-token");
  });

  it("mints customer-only claims for a customer and replaces the claims stored for that uid", async () => {
    mocks.getMobileAuthPayload.mockResolvedValue({
      id: "cust-1",
      role: "CUSTOMER",
      tenantId: "tenant-1",
      siteId: null,
    });
    const customerClaims: Record<string, unknown> = {
      role: "CUSTOMER",
      tenantId: null,
      departmentId: null,
      siteId: null,
      primarySiteId: null,
      accessAdminPanel: false,
      accessEmployeePanel: false,
      isSuperAdmin: false,
    };

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.setCustomUserClaims).toHaveBeenCalledWith(
      "cust-1",
      customerClaims,
    );
    expect(mocks.createCustomToken).toHaveBeenCalledWith(
      "cust-1",
      customerClaims,
    );
  });

  it.each([
    [
      "an employee",
      {
        id: "user-1",
        role: "TEKNISI",
        tenantId: "tenant-1",
        departmentId: "dept-1",
        siteId: "site-1",
        accessAdminPanel: false,
      },
      {
        role: "TEKNISI",
        tenantId: "tenant-1",
        departmentId: "dept-1",
        siteId: "site-1",
        primarySiteId: "site-1",
        accessAdminPanel: false,
        accessEmployeePanel: true,
        isSuperAdmin: false,
      },
    ],
    [
      "a partner",
      { id: "mitra-1", role: "MITRA", tenantId: "tenant-1", siteId: null },
      {
        role: "MITRA",
        tenantId: "tenant-1",
        departmentId: null,
        siteId: null,
        primarySiteId: null,
        accessAdminPanel: false,
        accessEmployeePanel: true,
        isSuperAdmin: false,
      },
    ],
  ])("keeps the claims it gave %s", async (_who, session, claims) => {
    mocks.getMobileAuthPayload.mockResolvedValue(session);

    await POST(request());

    expect(mocks.setCustomUserClaims).toHaveBeenCalledWith(session.id, claims);
    expect(mocks.createCustomToken).toHaveBeenCalledWith(session.id, claims);
  });
});
