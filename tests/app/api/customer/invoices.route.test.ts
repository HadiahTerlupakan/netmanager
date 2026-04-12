import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  requireCustomerAuth: vi.fn(),
  getInvoices: vi.fn(),
}));

vi.mock("@/lib/customer-auth", () => ({
  requireCustomerAuth: mockFns.requireCustomerAuth,
}));

vi.mock("@/modules/pelanggan", () => ({
  CustomerPortalService: class MockCustomerPortalService {
    getInvoices = mockFns.getInvoices;
  },
}));

describe("customer invoices route", () => {
  let GET: (typeof import("@/app/api/customer/invoices/route"))["GET"];

  beforeAll(async () => {
    ({ GET } = await import("@/app/api/customer/invoices/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns standardized invoice payload with pagination", async () => {
    mockFns.requireCustomerAuth.mockResolvedValue({
      session: { id: "customer-1" },
    });
    mockFns.getInvoices.mockResolvedValue({
      invoices: [{ id: "inv-1" }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/customer/invoices?page=1&limit=10"),
    );
    const body = (await response.json()) as {
      success: boolean;
      data: {
        invoices: Array<{ id: string }>;
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.invoices).toEqual([{ id: "inv-1" }]);
    expect(body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    expect(mockFns.getInvoices).toHaveBeenCalledWith(
      "customer-1",
      1,
      10,
      undefined,
    );
  });

  it("falls back to safe pagination values when query params are invalid", async () => {
    mockFns.requireCustomerAuth.mockResolvedValue({
      session: { id: "customer-1" },
    });
    mockFns.getInvoices.mockResolvedValue({
      invoices: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/customer/invoices?page=abc&limit=0&status=PAID,UNPAID",
      ),
    );

    expect(response.status).toBe(200);
    expect(mockFns.getInvoices).toHaveBeenCalledWith("customer-1", 1, 10, [
      "PAID",
      "UNPAID",
    ]);
  });
});
