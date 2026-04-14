import { AsyncLocalStorage } from "node:async_hooks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockGetServerSession = vi.fn();
const mockGetMobileTokenDetails = vi.fn();
const mockVerifyMobileToken = vi.fn();
const mockLogRequest = vi.fn();
const mockLogResponse = vi.fn();
const mockLogAuditActivity = vi.fn().mockResolvedValue(undefined);
const mockHeaders = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("next/headers", () => ({
  headers: (...args: unknown[]) => mockHeaders(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/mobile-auth", () => ({
  getMobileTokenDetails: (...args: unknown[]) =>
    mockGetMobileTokenDetails(...args),
  verifyMobileToken: (...args: unknown[]) => mockVerifyMobileToken(...args),
}));

vi.mock("@/lib/middleware/request-logger", () => ({
  logRequest: (...args: unknown[]) => mockLogRequest(...args),
  logResponse: (...args: unknown[]) => mockLogResponse(...args),
  logAuditActivity: (...args: unknown[]) => mockLogAuditActivity(...args),
}));

describe("prisma extension tenant-context alias", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(null);
    mockGetMobileTokenDetails.mockResolvedValue(null);
    mockVerifyMobileToken.mockResolvedValue({
      userId: "user-1",
      role: "TEKNISI",
      tenantId: "tenant-1",
      siteId: "site-1",
      permissions: [],
      isSuperAdmin: false,
    });
    mockHeaders.mockResolvedValue(
      new Headers({ authorization: "Bearer valid-token" }),
    );
    (globalThis as Record<string, unknown>).IS_CUSTOM_SERVER = false;
  });

  it("tetap memakai cached tenant context saat prisma extension dan handler memakai module tenant-context yang sama", async () => {
    const tenantContextStorage = new AsyncLocalStorage<{
      tenantId: string | null;
      isSuperAdmin: boolean;
    }>();

    vi.doMock("@/lib/tenant-context", () => ({
      getTenantIdFromContext: vi.fn(async () => {
        return (
          tenantContextStorage.getStore() ?? {
            tenantId: null,
            isSuperAdmin: false,
          }
        );
      }),
      runWithRequestTenantContext: (
        tenantContext: { tenantId: string | null; isSuperAdmin: boolean },
        callback: () => Promise<unknown>,
      ) => tenantContextStorage.run(tenantContext, callback),
    }));

    const { createHandler } = await import("@/lib/api/handler");

    const route = createHandler({ auth: true }, async () => {
      const { withTenantIsolation } = await import("@/lib/prisma-extension");
      const tenantExtension = withTenantIsolation([]);
      const runTenantQuery = tenantExtension.query.$allModels
        .$allOperations as ({
        model,
        operation,
        args,
        query,
      }: {
        model?: string;
        operation: string;
        args: Record<string, unknown>;
        query: (args: unknown) => Promise<unknown>;
      }) => Promise<unknown>;

      await runTenantQuery({
        model: "User",
        operation: "findMany",
        args: { where: {} },
        query: async (args) => args,
      });

      return NextResponse.json({ ok: true });
    });

    const response = await route(
      new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer valid-token" },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(mockVerifyMobileToken).toHaveBeenCalledTimes(1);
  });
});
