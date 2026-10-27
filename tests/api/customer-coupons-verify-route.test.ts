import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  requireCustomerAuth: vi.fn(),
  getTenantIdFromContext: vi.fn(),
  verifyCoupon: vi.fn(),
}));

vi.mock("@/lib/customer-auth", () => ({
  requireCustomerAuth: mockFns.requireCustomerAuth,
}));

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: mockFns.getTenantIdFromContext,
}));

vi.mock("@/modules/coupons", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/coupons")>();
  return {
    verifyCouponSchema: actual.verifyCouponSchema,
    couponService: { verifyCoupon: mockFns.verifyCoupon },
  };
});

import { POST } from "@/app/api/customer/coupons/verify/route";

function verifyRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/customer/coupons/verify", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/customer/coupons/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.requireCustomerAuth.mockResolvedValue({
      session: {
        id: "pelanggan-sesi",
        idPelanggan: "PLG-001",
        nama: "Budi",
        username: "budi",
        status: "AKTIF",
      },
    });
    mockFns.getTenantIdFromContext.mockResolvedValue({
      tenantId: "tenant-a",
      isSuperAdmin: false,
    });
    mockFns.verifyCoupon.mockResolvedValue({
      valid: true,
      discountAmount: 10000,
      finalAmount: 90000,
      couponId: "coupon-1",
    });
  });

  it("menolak tanpa sesi pelanggan dan tidak memverifikasi kupon", async () => {
    mockFns.requireCustomerAuth.mockResolvedValue({
      response: NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      ),
    });

    const response = await POST(verifyRequest({ code: "HEMAT", amount: 1 }));

    expect(response.status).toBe(401);
    expect(mockFns.verifyCoupon).not.toHaveBeenCalled();
  });

  it("memakai id pelanggan dari sesi dan tenant dari konteks, bukan dari body", async () => {
    const response = await POST(
      verifyRequest({
        code: "hemat",
        amount: 100000,
        pelangganId: "pelanggan-lain",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockFns.verifyCoupon).toHaveBeenCalledWith(
      "hemat",
      100000,
      "pelanggan-sesi",
      "tenant-a",
    );
    expect(body.data).toEqual({
      valid: true,
      code: "HEMAT",
      discountAmount: 10000,
      finalAmount: 90000,
    });
  });

  it("menolak saat tenant tidak diketahui agar kupon tenant lain tidak terbaca", async () => {
    mockFns.getTenantIdFromContext.mockResolvedValue({
      tenantId: null,
      isSuperAdmin: false,
    });

    const response = await POST(verifyRequest({ code: "HEMAT", amount: 1 }));

    expect(response.status).toBe(400);
    expect(mockFns.verifyCoupon).not.toHaveBeenCalled();
  });

  it("mengembalikan 400 beserta alasan saat kupon tidak valid", async () => {
    mockFns.verifyCoupon.mockResolvedValue({
      valid: false,
      error: "Kuota kupon habis",
      discountAmount: 0,
      finalAmount: 1,
    });

    const response = await POST(verifyRequest({ code: "HABIS", amount: 1 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Kuota kupon habis");
  });

  it("menolak payload tanpa kode kupon", async () => {
    const response = await POST(verifyRequest({ amount: 1 }));

    expect(response.status).toBe(400);
    expect(mockFns.verifyCoupon).not.toHaveBeenCalled();
  });
});
