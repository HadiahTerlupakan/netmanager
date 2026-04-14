import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getUserPermissions: vi.fn(),
  isSuperAdmin: vi.fn(),
  fetchCustomerDetail: vi.fn(),
  createWorkOrder: vi.fn(),
  onWorkOrderCreated: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getUserPermissions: mockFns.getUserPermissions,
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/modules/database", () => ({
  prisma: {},
}));

vi.mock("@/modules/integrations", () => ({
  MixRadiusService: class MockMixRadiusService {
    fetchCustomerDetail = mockFns.fetchCustomerDetail;
  },
}));

vi.mock("@/modules/work-order", () => ({
  WorkOrderRepository: class MockWorkOrderRepository {
    constructor() {}
    create = mockFns.createWorkOrder;
  },
  onWorkOrderCreated: mockFns.onWorkOrderCreated,
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
    notFound: (message = "Not found") =>
      NextResponse.json({ success: false, error: message }, { status: 404 }),
  },
  ErrorCodes: {
    MIXRADIUS_CONFIG_ERROR: "MIXRADIUS_CONFIG_ERROR",
    VALIDATION_ERROR: "VALIDATION_ERROR",
  },
}));

import { POST } from "@/app/api/integrations/mixradius/dismantle/route";

describe("POST /api/integrations/mixradius/dismantle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.isSuperAdmin.mockReturnValue(false);
    mockFns.getUserPermissions.mockResolvedValue([
      "mixradius:read",
      "workorders:create",
    ]);
  });

  it("returns 503 config error instead of creating bogus dismantle work order", async () => {
    const configError = new Error(
      "URL MixRadius tidak valid atau belum dikonfigurasi.",
    );
    configError.name = "MixRadiusConfigError";
    mockFns.fetchCustomerDetail.mockRejectedValue(configError);

    const request = new NextRequest(
      "http://localhost/api/integrations/mixradius/dismantle",
      {
        method: "POST",
        body: JSON.stringify({
          customerId: "cust-1",
          reason: "Isolir/Tunggakan",
          notes: "Request otomatis dari Aplikasi Mobile (Menu Isolir)",
        }),
        headers: {
          "content-type": "application/json",
        },
      },
    );

    const response = await POST(request, {
      session: { user: { id: "user-1" } },
      params: {},
    } as never);
    const json = await response.json();

    expect(mockFns.fetchCustomerDetail).toHaveBeenCalledWith("cust-1");
    expect(mockFns.createWorkOrder).not.toHaveBeenCalled();
    expect(mockFns.onWorkOrderCreated).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(json).toEqual({
      success: false,
      error: "URL MixRadius tidak valid atau belum dikonfigurasi.",
      code: "MIXRADIUS_CONFIG_ERROR",
      details: { isConfigError: true },
    });
  });
});
