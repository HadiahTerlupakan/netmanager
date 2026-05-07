import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
  canAccessDismantle: vi.fn(),
  createDismantleRequest: vi.fn(),
  createWorkOrder: vi.fn(),
  onWorkOrderCreated: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockFns.isSuperAdmin,
}));

vi.mock("@/modules/database", () => ({
  prisma: {},
}));

vi.mock("@/modules/integrations", () => ({
  getMixRadiusAccessService: () => ({
    canAccessDismantle: mockFns.canAccessDismantle,
  }),
  MixRadiusConfigError: class MockMixRadiusConfigError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "MixRadiusConfigError";
    }
  },
  MixRadiusDismantleService: class MockMixRadiusDismantleService {
    createDismantleRequest = mockFns.createDismantleRequest;
  },
}));

vi.mock("@/modules/work-order", () => ({
  WorkOrderRepository: class MockWorkOrderRepository {
    constructor() {}
    create = mockFns.createWorkOrder;
  },
  onWorkOrderCreated: mockFns.onWorkOrderCreated,
}));

vi.mock("@/modules/finance", () => ({
  isRouteServiceError: (error: unknown): error is { status: number } =>
    error instanceof Error && "status" in error,
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
    mockFns.canAccessDismantle.mockResolvedValue(true);
  });

  it("returns 503 config error instead of creating bogus dismantle work order", async () => {
    const { MixRadiusConfigError } = await import("@/modules/integrations");
    mockFns.createDismantleRequest.mockRejectedValue(
      new MixRadiusConfigError(
        "URL MixRadius tidak valid atau belum dikonfigurasi.",
      ),
    );

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

    expect(mockFns.createDismantleRequest).toHaveBeenCalledWith({
      userId: "user-1",
      customerId: "cust-1",
      reason: "Isolir/Tunggakan",
      notes: "Request otomatis dari Aplikasi Mobile (Menu Isolir)",
    });
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
