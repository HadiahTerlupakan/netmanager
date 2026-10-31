import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCustomerAuth: vi.fn(),
  createCustomToken: vi.fn(),
  advancedRateLimit: vi.fn(),
}));

vi.mock("@/lib/customer-auth", () => ({
  requireCustomerAuth: mocks.requireCustomerAuth,
}));

vi.mock("@/lib/firebase/admin", () => ({
  auth: { createCustomToken: mocks.createCustomToken },
}));

vi.mock("@/lib/middleware/advanced-rate-limit", () => ({
  advancedRateLimit: mocks.advancedRateLimit,
}));

import { POST } from "@/app/api/customer/firebase-token/route";

const customerSession = {
  id: "cust-1",
  idPelanggan: "PLG-001",
  nama: "Pelanggan",
  username: "pelanggan",
  status: "AKTIF",
};

const request = () =>
  new NextRequest(
    "https://pelanggan.example.test/api/customer/firebase-token",
    {
      method: "POST",
    },
  );

/**
 * Realtime portal pelanggan masuk ke Firebase dengan cookie sesi pelanggan.
 * Aturan Firestore membuka `users/<uid>/events` untuk pemilik uid, dan
 * `tickets/*`/`workorders/*` untuk token yang tenant-nya cocok; token
 * pelanggan karena itu tidak boleh membawa tenant atau akses staf apa pun.
 */
describe("customer firebase token route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCustomerAuth.mockResolvedValue({ session: customerSession });
    mocks.advancedRateLimit.mockResolvedValue(null);
    mocks.createCustomToken.mockResolvedValue("customer-custom-token");
  });

  it("mints a token for the customer's own uid with customer-only claims", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: "customer-custom-token" });
    expect(mocks.createCustomToken).toHaveBeenCalledWith("cust-1", {
      role: "CUSTOMER",
      tenantId: null,
      departmentId: null,
      siteId: null,
      primarySiteId: null,
      accessAdminPanel: false,
      accessEmployeePanel: false,
      isSuperAdmin: false,
    });
  });

  it("refuses a request without a customer session", async () => {
    mocks.requireCustomerAuth.mockResolvedValue({
      response: NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      ),
    });

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.createCustomToken).not.toHaveBeenCalled();
  });

  it("limits how often one customer can mint a token", async () => {
    mocks.advancedRateLimit.mockResolvedValue(
      NextResponse.json(
        { error: "Terlalu banyak permintaan" },
        { status: 429 },
      ),
    );

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(mocks.createCustomToken).not.toHaveBeenCalled();
    const [, options] = mocks.advancedRateLimit.mock.calls[0] ?? [];
    expect(options.keyGenerator()).toContain("cust-1");
  });
});
