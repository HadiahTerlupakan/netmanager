import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  verifyManualPayment: vi.fn(),
  checkSiteRestriction: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockFns.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/modules/finance", () => ({
  ManualPaymentAdminRouteService: class {
    verifyManualPayment = mockFns.verifyManualPayment;
  },
  isRouteServiceError: () => false,
}));

vi.mock("@/modules/roles", () => ({
  checkSiteRestriction: mockFns.checkSiteRestriction,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { POST } from "@/app/api/admin/payments/verify-manual/route";

describe("admin verify-manual payment route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getServerSession.mockResolvedValue({
      user: {
        id: "admin-1",
        email: "admin@test.com",
        role: "ADMIN",
        tenantId: "tenant-1",
        isSuperAdmin: false,
        permissions: ["manual_payments:verify"],
      },
    });
    mockFns.getUserPermissions.mockResolvedValue(["manual_payments:verify"]);
    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: false,
      siteIds: [],
    });
    mockFns.verifyManualPayment.mockResolvedValue({
      success: true,
      message: "Payment approved",
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockFns.getServerSession.mockResolvedValueOnce(null);

    const response = await POST(
      new NextRequest("http://localhost/api/admin/payments/verify-manual", {
        method: "POST",
        body: JSON.stringify({ paymentId: "pay-1", action: "approve" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(401);
    expect(mockFns.verifyManualPayment).not.toHaveBeenCalled();
  });

  it("calls verifyManualPayment for authenticated admin with correct permissions", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/admin/payments/verify-manual", {
        method: "POST",
        body: JSON.stringify({ paymentId: "pay-1", action: "approve" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(mockFns.verifyManualPayment).toHaveBeenCalledWith({
      paymentId: "pay-1",
      action: "approve",
      notes: undefined,
      allowedSiteIds: undefined,
    });
  });
});
