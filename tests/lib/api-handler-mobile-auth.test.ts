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

vi.unmock("@/lib/tenant-context");

vi.mock("@/lib/middleware/request-logger", () => ({
  logRequest: (...args: unknown[]) => mockLogRequest(...args),
  logResponse: (...args: unknown[]) => mockLogResponse(...args),
  logAuditActivity: (...args: unknown[]) => mockLogAuditActivity(...args),
}));

import { createHandler } from "@/lib/api/handler";

describe("createHandler mobile auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(null);
    mockGetMobileTokenDetails.mockResolvedValue(null);
    mockVerifyMobileToken.mockResolvedValue(null);
    mockHeaders.mockResolvedValue(new Headers());
    (globalThis as Record<string, unknown>).IS_CUSTOM_SERVER = false;
  });

  it("meneruskan siteId dari mobile token ke ctx.session.user", async () => {
    const route = createHandler({ auth: true }, async (_req, ctx) => {
      return NextResponse.json({ user: ctx.session?.user });
    });

    mockVerifyMobileToken.mockResolvedValue({
      userId: "user-1",
      role: "TEKNISI",
      tenantId: "tenant-1",
      siteId: "site-1",
      permissions: [],
    });

    const response = await route(
      new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer valid-token" },
      }),
      { params: Promise.resolve({}) },
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user).toEqual(
      expect.objectContaining({
        id: "user-1",
        tenantId: "tenant-1",
        siteId: "site-1",
      }),
    );
  });

  it("menggunakan tenant context dari session request yang sama tanpa verifikasi token ulang", async () => {
    const route = createHandler({ auth: true }, async () => {
      const { getTenantIdFromContext } = await import("@/lib/tenant-context");
      const tenantContext = await getTenantIdFromContext();
      return NextResponse.json({ tenantContext });
    });

    mockGetMobileTokenDetails.mockResolvedValue({
      payload: { sub: "user-1", appVersionCode: 100 },
      versionCode: 100,
      versionAccess: {
        isSupported: true,
        updateAvailable: false,
        isForceUpdate: false,
        currentVersion: "1.0.0",
        currentVersionCode: 100,
        minimumVersion: null,
        latestVersion: null,
      },
    });
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

    const response = await route(
      new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer valid-token" },
      }),
      { params: Promise.resolve({}) },
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tenantContext).toEqual({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });
    expect(mockGetMobileTokenDetails).toHaveBeenCalledWith("valid-token");
    expect(mockVerifyMobileToken).toHaveBeenCalledWith(
      "valid-token",
      undefined,
      {
        payload: { sub: "user-1", appVersionCode: 100 },
        versionCode: 100,
        versionAccess: {
          isSupported: true,
          updateAvailable: false,
          isForceUpdate: false,
          currentVersion: "1.0.0",
          currentVersionCode: 100,
          minimumVersion: null,
          latestVersion: null,
        },
      },
    );
    expect(mockVerifyMobileToken).toHaveBeenCalledTimes(1);
  });

  it("meneruskan header versi request saat bearer token diverifikasi", async () => {
    const route = createHandler({ auth: true }, async (_req, ctx) => {
      return NextResponse.json({ user: ctx.session?.user });
    });

    mockGetMobileTokenDetails.mockResolvedValue({
      payload: { sub: "user-1", appVersionCode: 54 },
      versionCode: 100,
      versionAccess: {
        isSupported: true,
        updateAvailable: false,
        isForceUpdate: false,
        currentVersion: "1.0.100",
        currentVersionCode: 100,
        minimumVersion: null,
        latestVersion: null,
      },
    });
    mockVerifyMobileToken.mockResolvedValue({
      userId: "user-1",
      role: "TEKNISI",
      tenantId: "tenant-1",
      siteId: "site-1",
      permissions: [],
      isSuperAdmin: false,
    });

    const response = await route(
      new NextRequest("http://localhost/api/test", {
        headers: {
          Authorization: "Bearer valid-token",
          "x-app-version-code": "100",
        },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(mockGetMobileTokenDetails).toHaveBeenCalledWith("valid-token", 100);
    expect(mockVerifyMobileToken).toHaveBeenCalledWith("valid-token", 100, {
      payload: { sub: "user-1", appVersionCode: 54 },
      versionCode: 100,
      versionAccess: {
        isSupported: true,
        updateAvailable: false,
        isForceUpdate: false,
        currentVersion: "1.0.100",
        currentVersionCode: 100,
        minimumVersion: null,
        latestVersion: null,
      },
    });
  });

  it("tetap memakai tenant context request saat prisma tenant isolation berjalan", async () => {
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

    mockGetMobileTokenDetails.mockResolvedValue({
      payload: { sub: "user-1", appVersionCode: 100 },
      versionCode: 100,
      versionAccess: {
        isSupported: true,
        updateAvailable: false,
        isForceUpdate: false,
        currentVersion: "1.0.0",
        currentVersionCode: 100,
        minimumVersion: null,
        latestVersion: null,
      },
    });
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

    const response = await route(
      new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer valid-token" },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(mockVerifyMobileToken).toHaveBeenCalledTimes(1);
  });

  it("tetap memakai tenant context request saat query prisma berjalan setelah hop async", async () => {
    const route = createHandler({ auth: true }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));

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

    mockGetMobileTokenDetails.mockResolvedValue({
      payload: { sub: "user-1", appVersionCode: 100 },
      versionCode: 100,
      versionAccess: {
        isSupported: true,
        updateAvailable: false,
        isForceUpdate: false,
        currentVersion: "1.0.0",
        currentVersionCode: 100,
        minimumVersion: null,
        latestVersion: null,
      },
    });
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

    const response = await route(
      new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer valid-token" },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(mockVerifyMobileToken).toHaveBeenCalledTimes(1);
  });

  it("mempertahankan tenant context untuk query prisma di task fire-and-forget setelah response dibuat", async () => {
    let backgroundTask: Promise<unknown> | null = null;

    const route = createHandler({ auth: true }, async () => {
      backgroundTask = (async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
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

        return runTenantQuery({
          model: "User",
          operation: "findMany",
          args: { where: {} },
          query: async (args) => args,
        });
      })();

      return NextResponse.json({ ok: true });
    });

    mockGetMobileTokenDetails.mockResolvedValue({
      payload: { sub: "user-1", appVersionCode: 100 },
      versionCode: 100,
      versionAccess: {
        isSupported: true,
        updateAvailable: false,
        isForceUpdate: false,
        currentVersion: "1.0.0",
        currentVersionCode: 100,
        minimumVersion: null,
        latestVersion: null,
      },
    });
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

    const response = await route(
      new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer valid-token" },
      }),
      { params: Promise.resolve({}) },
    );

    await backgroundTask;

    expect(response.status).toBe(200);
    expect(mockVerifyMobileToken).toHaveBeenCalledTimes(1);
  });

  it("mempertahankan tenant context untuk task fire-and-forget setelah response dibuat", async () => {
    let backgroundTask: Promise<{
      tenantId: string | null;
      isSuperAdmin: boolean;
    }> | null = null;

    const route = createHandler({ auth: true }, async () => {
      backgroundTask = (async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        const { getTenantIdFromContext } = await import("@/lib/tenant-context");
        return getTenantIdFromContext();
      })();

      return NextResponse.json({ ok: true });
    });

    mockGetMobileTokenDetails.mockResolvedValue({
      payload: { sub: "user-1", appVersionCode: 100 },
      versionCode: 100,
      versionAccess: {
        isSupported: true,
        updateAvailable: false,
        isForceUpdate: false,
        currentVersion: "1.0.0",
        currentVersionCode: 100,
        minimumVersion: null,
        latestVersion: null,
      },
    });
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

    const response = await route(
      new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer valid-token" },
      }),
      { params: Promise.resolve({}) },
    );

    const backgroundContext = await backgroundTask;

    expect(response.status).toBe(200);
    expect(backgroundContext).toEqual({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });
    expect(mockVerifyMobileToken).toHaveBeenCalledTimes(1);
  });
});
