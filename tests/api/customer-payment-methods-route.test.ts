import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  requireCustomerAuth: vi.fn(),
  getTenantIdFromContext: vi.fn(),
  getCustomerPaymentMethods: vi.fn(),
}));

vi.mock("@/lib/customer-auth", () => ({
  requireCustomerAuth: mockFns.requireCustomerAuth,
}));

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: mockFns.getTenantIdFromContext,
}));

vi.mock("@/modules/finance", () => ({
  CustomerPaymentMethodService: class {
    getCustomerPaymentMethods = mockFns.getCustomerPaymentMethods;
  },
}));

import { GET } from "@/app/api/customer/payment-methods/route";

const get = (query = "") =>
  GET(new NextRequest(`http://localhost/api/customer/payment-methods${query}`));

describe("GET /api/customer/payment-methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.requireCustomerAuth.mockResolvedValue({
      session: { id: "customer-1" },
    });
    mockFns.getTenantIdFromContext.mockResolvedValue({ tenantId: "tenant-a" });
    mockFns.getCustomerPaymentMethods.mockResolvedValue([]);
  });

  it("meneruskan nominal tagihan untuk menyaring kanal aktif", async () => {
    const response = await get("?amount=11100");

    expect(response.status).toBe(200);
    expect(mockFns.getCustomerPaymentMethods).toHaveBeenCalledWith(
      "tenant-a",
      11100,
    );
  });

  // Tiap permintaan bisa memicu panggilan getpaymentmethod ke Duitku.
  it("membatasi permintaan berulang dari pelanggan yang sama", async () => {
    mockFns.requireCustomerAuth.mockResolvedValue({
      session: { id: "customer-pembatas" },
    });

    const statuses: number[] = [];
    for (let i = 0; i < 21; i += 1) {
      statuses.push((await get(`?amount=${10000 + i}`)).status);
    }

    expect(statuses.filter((status) => status === 200)).toHaveLength(20);
    expect(statuses.at(-1)).toBe(429);
  });

  it.each(["", "?amount=abc", "?amount=-5", "?amount=1.5"])(
    "nominal yang tidak ada atau tidak sah (%s) diabaikan",
    async (query) => {
      await get(query);

      expect(mockFns.getCustomerPaymentMethods).toHaveBeenCalledWith(
        "tenant-a",
        undefined,
      );
    },
  );
});
