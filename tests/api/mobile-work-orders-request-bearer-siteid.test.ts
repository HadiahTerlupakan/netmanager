import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  getMobileTokenDetails: vi.fn(),
  verifyMobileToken: vi.fn(),
  createRequest: vi.fn(),
  logRequest: vi.fn(),
  logResponse: vi.fn(),
  logAuditActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockFns.getServerSession(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: (...args: unknown[]) =>
    mockFns.getUserPermissions(...args),
}));

vi.mock("@/lib/mobile-auth", () => ({
  getMobileTokenDetails: (...args: unknown[]) =>
    mockFns.getMobileTokenDetails(...args),
  verifyMobileToken: (...args: unknown[]) => mockFns.verifyMobileToken(...args),
}));

vi.mock("@/lib/middleware/request-logger", () => ({
  logRequest: (...args: unknown[]) => mockFns.logRequest(...args),
  logResponse: (...args: unknown[]) => mockFns.logResponse(...args),
  logAuditActivity: (...args: unknown[]) => mockFns.logAuditActivity(...args),
}));

vi.unmock("@/lib/tenant-context");

vi.mock("@/modules/work-order", () => ({
  mobileWorkOrderRequestService: {
    createRequest: (...args: unknown[]) => mockFns.createRequest(...args),
  },
}));

import { POST } from "@/app/api/mobile/work-orders/request/route";

describe("mobile work orders request route bearer auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as Record<string, unknown>).IS_CUSTOM_SERVER = false;
    mockFns.getServerSession.mockResolvedValue(null);
    mockFns.getUserPermissions.mockResolvedValue([]);
    mockFns.getMobileTokenDetails.mockResolvedValue(null);
    mockFns.verifyMobileToken.mockResolvedValue({
      userId: "user-1",
      role: "TEKNISI",
      tenantId: "tenant-1",
      siteId: "site-1",
      permissions: [],
      isSuperAdmin: false,
    });
    mockFns.createRequest.mockResolvedValue({
      id: "wo-request-1",
      title: "Request Dismantle: Pelanggan A",
      status: "REQUESTED",
    });
  });

  it("meneruskan siteId bearer token ke service saat body tidak mengirim siteId", async () => {
    const payload = {
      type: "DISCONNECTION",
      title: "Request Dismantle: Pelanggan A",
      description: "Permintaan pembongkaran perangkat",
      priority: "HIGH",
      contactName: "Pelanggan A",
    };

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders/request", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          Authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    expect(mockFns.createRequest).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({
        id: "user-1",
        tenantId: "tenant-1",
        siteId: "site-1",
      }),
    );
  });

  it("mempertahankan tenant context bearer saat fan-out async berjalan dalam request work-order yang sama", async () => {
    const payload = {
      type: "DISCONNECTION",
      title: "Request Dismantle: Pelanggan A",
      description: "Permintaan pembongkaran perangkat",
      priority: "HIGH",
      contactName: "Pelanggan A",
    };
    let tenantContexts: Array<{
      tenantId: string | null;
      isSuperAdmin: boolean;
    }> = [];

    mockFns.createRequest.mockImplementationOnce(async () => {
      tenantContexts = await Promise.all(
        Array.from({ length: 5 }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
          const { getTenantIdFromContext } =
            await import("@/lib/tenant-context");
          return getTenantIdFromContext();
        }),
      );

      return {
        id: "wo-request-1",
        title: "Request Dismantle: Pelanggan A",
        status: "REQUESTED",
      };
    });

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/work-orders/request", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          Authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    expect(tenantContexts).toEqual(
      Array.from({ length: 5 }, () => ({
        tenantId: "tenant-1",
        isSuperAdmin: false,
      })),
    );
    expect(mockFns.verifyMobileToken).toHaveBeenCalledTimes(1);
  });
});
