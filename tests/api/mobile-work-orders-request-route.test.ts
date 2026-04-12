import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  createRequest: vi.fn(),
  repositoryFindById: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  createHandler: (_options: unknown, handler: unknown) => handler,
  apiSuccess: (data: unknown, init?: { message?: string; status?: number }) =>
    NextResponse.json(
      { success: true, data, message: init?.message },
      { status: init?.status || 200 },
    ),
  apiError: (message: string, _code?: string, init?: { status?: number }) =>
    NextResponse.json(
      { success: false, error: message },
      { status: init?.status || 500 },
    ),
  ErrorCodes: {
    BAD_REQUEST: "BAD_REQUEST",
  },
}));

vi.mock("@/modules/work-order", () => ({
  mobileWorkOrderRequestService: {
    createRequest: mockFns.createRequest,
  },
  WorkOrderRepository: class MockWorkOrderRepository {
    constructor() {}
    findById = mockFns.repositoryFindById;
  },
}));

import { POST } from "@/app/api/mobile/work-orders/request/route";

describe("mobile work orders request route", () => {
  const session = {
    user: {
      id: "user-1",
      tenantId: "tenant-1",
      name: "Pemohon",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.createRequest.mockResolvedValue({
      id: "wo-request-1",
      status: "REQUESTED",
      title: "Gangguan internet",
    });
  });

  it("membuat request work order tanpa lookup work order existing", async () => {
    const payload = {
      type: "MAINTENANCE",
      title: "Gangguan internet",
      description: "Modem mati total",
    };

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders/request", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
      }),
      {
        session,
      } as never,
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockFns.createRequest).toHaveBeenCalledWith(payload, session.user);
    expect(mockFns.repositoryFindById).not.toHaveBeenCalled();
    expect(body.message).toContain("Menunggu persetujuan Admin");
  });
});
