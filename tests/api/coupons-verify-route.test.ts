import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  verifyCoupon: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockFns.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/modules/coupons", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/coupons")>();
  return {
    verifyCouponSchema: actual.verifyCouponSchema,
    couponService: { verifyCoupon: mockFns.verifyCoupon },
  };
});

import { POST } from "@/app/api/coupons/verify/route";

const staffSession = (permissions: string[]) => ({
  user: {
    id: "staf-1",
    email: "staf@isp.test",
    tenantId: "tenant-a",
    permissions,
  },
});

function verifyRequest(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/coupons/verify", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({}) },
  );
}

/**
 * Rute verifikasi kupon staf dulu hanya menuntut sesi apa pun dan meneruskan
 * `pelangganId` dari body; aplikasi pelanggan yang memanggilnya mendapat 401
 * lalu dikeluarkan dari akunnya.
 */
describe("POST /api/coupons/verify (staf)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.verifyCoupon.mockResolvedValue({
      valid: true,
      discountAmount: 10000,
      finalAmount: 90000,
      couponId: "coupon-1",
    });
  });

  it("menolak staf tanpa izin membaca kupon", async () => {
    mockFns.getServerSession.mockResolvedValue(staffSession(["finance:read"]));

    const response = await verifyRequest({ code: "HEMAT", amount: 100000 });

    expect(response.status).toBe(403);
    expect(mockFns.verifyCoupon).not.toHaveBeenCalled();
  });

  it("tidak meneruskan pelangganId dari body", async () => {
    mockFns.getServerSession.mockResolvedValue(staffSession(["coupon:read"]));

    const response = await verifyRequest({
      code: "HEMAT",
      amount: 100000,
      pelangganId: "pelanggan-orang-lain",
    });

    expect(response.status).toBe(200);
    expect(mockFns.verifyCoupon).toHaveBeenCalledWith(
      "HEMAT",
      100000,
      undefined,
      "tenant-a",
    );
  });
});
