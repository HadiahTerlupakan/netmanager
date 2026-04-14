import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
  fetchCustomerDetail: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getUserPermissions: mockFns.getUserPermissions,
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/modules/integrations", () => ({
  getMixRadiusService: () => ({
    fetchCustomerDetail: mockFns.fetchCustomerDetail,
  }),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiSuccess: (
    data: unknown,
    options?: { status?: number; message?: string },
  ) =>
    NextResponse.json(
      {
        success: true,
        data,
        ...(options?.message && { message: options.message }),
      },
      { status: options?.status || 200 },
    ),
  apiError: (
    error: string,
    code: string,
    options?: { status?: number; details?: Record<string, unknown> },
  ) =>
    NextResponse.json(
      {
        success: false,
        error,
        code,
        ...(options?.details && { details: options.details }),
      },
      { status: options?.status || 400 },
    ),
  ApiErrors: {
    forbidden: (message = "Forbidden") =>
      NextResponse.json({ success: false, error: message }, { status: 403 }),
  },
  ErrorCodes: {
    MIXRADIUS_CONFIG_ERROR: "MIXRADIUS_CONFIG_ERROR",
    VALIDATION_ERROR: "VALIDATION_ERROR",
  },
}));

import { GET } from "@/app/api/integrations/mixradius/customers/[id]/route";

describe("GET /api/integrations/mixradius/customers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getUserPermissions.mockResolvedValue(["mixradius:read"]);
    mockFns.isSuperAdmin.mockReturnValue(false);
  });

  it("returns 503 config error instead of customer placeholder data", async () => {
    const configError = new Error(
      "URL MixRadius tidak valid atau belum dikonfigurasi.",
    );
    configError.name = "MixRadiusConfigError";
    mockFns.fetchCustomerDetail.mockRejectedValue(configError);

    const request = new NextRequest(
      "http://localhost/api/integrations/mixradius/customers/cust-1",
    );

    const response = await GET(request, {
      session: { user: { id: "user-1" } },
      params: { id: "cust-1" },
    } as never);
    const json = await response.json();

    expect(mockFns.fetchCustomerDetail).toHaveBeenCalledWith("cust-1");
    expect(response.status).toBe(503);
    expect(json).toEqual({
      success: false,
      error: "URL MixRadius tidak valid atau belum dikonfigurasi.",
      code: "MIXRADIUS_CONFIG_ERROR",
      details: { isConfigError: true },
    });
  });
});
