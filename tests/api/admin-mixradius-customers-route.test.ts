import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
  fetchCustomersPPP: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getUserPermissions: mockFns.getUserPermissions,
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/modules/integrations", () => ({
  getMixRadiusService: () => ({
    fetchCustomersPPP: mockFns.fetchCustomersPPP,
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
}));

import { GET } from "@/app/api/integrations/mixradius/customers/route";

describe("GET /api/integrations/mixradius/customers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getUserPermissions.mockResolvedValue(["mixradius:read"]);
    mockFns.isSuperAdmin.mockReturnValue(false);
  });

  it("returns 503 config error instead of success empty state", async () => {
    const configError = new Error(
      "URL MixRadius tidak valid atau belum dikonfigurasi.",
    );
    configError.name = "MixRadiusConfigError";
    mockFns.fetchCustomersPPP.mockRejectedValue(configError);

    const request = new NextRequest(
      "http://localhost/api/integrations/mixradius/customers?search=yud",
    );

    const response = await GET(request, {
      session: { user: { id: "user-1" } },
      params: {},
    } as never);
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json).toEqual({
      success: false,
      error: "URL MixRadius tidak valid atau belum dikonfigurasi.",
      code: "MIXRADIUS_CONFIG_ERROR",
      details: { isConfigError: true },
    });
  });
});
