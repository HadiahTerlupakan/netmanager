import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateConfig,
  mockUpdateConfig,
  mockUpdateConfigForTenant,
  mockDeleteConfig,
  mockDeleteConfigForTenant,
  mockGetAllConfigs,
  mockGetAllConfigsByTenant,
  mockLogActivity,
  mockIsSuperAdmin,
  mockCanAccess,
  mockSessionUser,
} = vi.hoisted(() => ({
  mockCreateConfig: vi.fn(),
  mockUpdateConfig: vi.fn(),
  mockUpdateConfigForTenant: vi.fn(),
  mockDeleteConfig: vi.fn(),
  mockDeleteConfigForTenant: vi.fn(),
  mockGetAllConfigs: vi.fn(),
  mockGetAllConfigsByTenant: vi.fn(),
  mockLogActivity: vi.fn(),
  mockIsSuperAdmin: vi.fn(),
  mockCanAccess: vi.fn(),
  mockSessionUser: { id: "user-1", tenantId: "tenant-1" as string | undefined },
}));

vi.mock("@/lib/api", () => ({
  createHandler: (
    _options: unknown,
    handler: (
      req: Request,
      ctx: {
        session: { user: { id: string; tenantId?: string } };
        params: Record<string, string>;
      },
    ) => unknown,
  ) => {
    return (req: Request) =>
      handler(req, {
        session: { user: mockSessionUser },
        params: { id: "config-1" },
      });
  },
  apiSuccess: (data: unknown, options?: { status?: number }) => ({
    success: true,
    data,
    status: options?.status,
  }),
  apiError: (
    error: string,
    code: string,
    options?: { status?: number; details?: Record<string, unknown> },
  ) => ({
    success: false,
    error,
    code,
    status: options?.status,
    details: options?.details,
  }),
  ApiErrors: {
    forbidden: (message = "Forbidden") => ({
      success: false,
      error: message,
      status: 403,
    }),
  },
  ErrorCodes: {
    VALIDATION_ERROR: "VALIDATION_ERROR",
  },
}));

vi.mock("@/lib/auth", () => ({
  isSuperAdmin: mockIsSuperAdmin,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    logActivity: mockLogActivity,
  },
}));

const { mockCreateMixRadiusConfig, mockValidateUrl } = vi.hoisted(() => ({
  mockCreateMixRadiusConfig: vi.fn(
    (dto: {
      name: string;
      baseUrl: string;
      username: string;
      password: string;
    }) => ({
      name: dto.name,
      baseUrl: dto.baseUrl.startsWith("http")
        ? dto.baseUrl.replace(/\/$/, "")
        : `https://${dto.baseUrl.replace(/\/$/, "")}`,
      username: dto.username,
      password: dto.password,
      isActive: false,
    }),
  ),
  mockValidateUrl: vi.fn(() => ({ isValid: true })),
}));

vi.mock("@/modules/integrations", () => ({
  getMixRadiusAccessService: () => ({
    canAccess: mockCanAccess,
  }),
  getMixRadiusConfigService: () => ({
    createConfig: mockCreateConfig,
    updateConfig: mockUpdateConfig,
    updateConfigForTenant: mockUpdateConfigForTenant,
    deleteConfig: mockDeleteConfig,
    deleteConfigForTenant: mockDeleteConfigForTenant,
    getConfigs: mockGetAllConfigs,
    getAllConfigs: mockGetAllConfigs,
    getAllConfigsByTenant: mockGetAllConfigsByTenant,
  }),
  IntegrationFactory: {
    createMixRadiusConfig: mockCreateMixRadiusConfig,
    validateUrl: mockValidateUrl,
  },
}));

import { POST } from "@/app/api/integrations/mixradius/accounts/route";
import {
  DELETE,
  PUT,
} from "@/app/api/integrations/mixradius/accounts/[id]/route";

describe("MixRadius accounts routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser.tenantId = "tenant-1";
    mockIsSuperAdmin.mockReturnValue(true);
    mockCanAccess.mockResolvedValue(true);
    mockCreateConfig.mockResolvedValue({
      id: "config-1",
      apiUrl: "https://mixradius.example.com",
    });
    mockUpdateConfig.mockResolvedValue({
      id: "config-1",
      apiUrl: "https://mixradius.example.com",
    });
    mockUpdateConfigForTenant.mockResolvedValue({
      id: "config-1",
      apiUrl: "https://mixradius.example.com",
    });
    mockDeleteConfig.mockResolvedValue(undefined);
    mockDeleteConfigForTenant.mockResolvedValue(undefined);
  });

  it("normalizes bare base URLs on POST using the shared factory", async () => {
    const request = new Request(
      "http://localhost/api/integrations/mixradius/accounts",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Server Jakarta",
          baseUrl: "mixradius.example.com/",
          username: "admin",
          password: "secret",
          isActive: true,
        }),
      },
    );

    const response = await (
      POST as unknown as (
        req: Request,
      ) => Promise<{ success: boolean; data: unknown; status?: number }>
    )(request);

    expect(mockCreateConfig).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        baseUrl: "mixradius.example.com/",
        isActive: true,
        username: "admin",
        password: "secret",
      }),
    );
    expect(response.status).toBe(201);
  });

  it("normalizes bare base URLs on PUT using the shared factory", async () => {
    const request = new Request(
      "http://localhost/api/integrations/mixradius/accounts/config-1",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Server Jakarta",
          baseUrl: "mixradius.example.com/",
          username: "admin",
          isActive: false,
        }),
      },
    );

    const response = await (
      PUT as unknown as (
        req: Request,
      ) => Promise<{ success: boolean; data: unknown; status?: number }>
    )(request);

    expect(mockUpdateConfig).toHaveBeenCalledWith(
      "config-1",
      expect.objectContaining({
        baseUrl: "mixradius.example.com/",
        username: "admin",
      }),
      undefined,
    );
    expect(response.success).toBe(true);
  });

  it("allows activating an account without resubmitting URL fields", async () => {
    const request = new Request(
      "http://localhost/api/integrations/mixradius/accounts/config-1",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          isActive: true,
        }),
      },
    );

    const response = await (
      PUT as unknown as (
        req: Request,
      ) => Promise<
        | { success: boolean; error?: string }
        | { success: boolean; data: unknown; status?: number }
      >
    )(request);

    expect(mockUpdateConfig).toHaveBeenCalledWith(
      "config-1",
      { isActive: true },
      undefined,
    );
    expect(response.success).toBe(true);
  });

  it("rejects POST when non-superadmin has no tenantId", async () => {
    mockIsSuperAdmin.mockReturnValue(false);
    mockCanAccess.mockResolvedValue(true);
    mockSessionUser.tenantId = undefined;

    const request = new Request(
      "http://localhost/api/integrations/mixradius/accounts",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Server Jakarta",
          baseUrl: "mixradius.example.com/",
          username: "admin",
          password: "secret",
        }),
      },
    );

    const response = await (
      POST as unknown as (
        req: Request,
      ) => Promise<{ success: boolean; error?: string; status?: number }>
    )(request);

    expect(response.success).toBe(false);
    expect(response.status).toBe(400);
    expect(mockCreateConfig).not.toHaveBeenCalled();
  });

  it("allows superadmin to POST account with explicit tenantId in body", async () => {
    mockIsSuperAdmin.mockReturnValue(true);
    mockCanAccess.mockResolvedValue(true);
    mockSessionUser.tenantId = undefined;

    const request = new Request(
      "http://localhost/api/integrations/mixradius/accounts",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Server Jakarta",
          baseUrl: "mixradius.example.com/",
          username: "admin",
          password: "secret",
          tenantId: "target-tenant",
        }),
      },
    );

    const response = await (
      POST as unknown as (
        req: Request,
      ) => Promise<{ success: boolean; data?: unknown; status?: number }>
    )(request);

    expect(response.success).toBe(true);
    expect(response.status).toBe(201);
    expect(mockCreateConfig).toHaveBeenCalledWith(
      "target-tenant",
      expect.objectContaining({
        baseUrl: "mixradius.example.com/",
        username: "admin",
        password: "secret",
      }),
    );
  });

  it("scopes PUT by tenantId for non-superadmin", async () => {
    mockIsSuperAdmin.mockReturnValue(false);
    mockCanAccess.mockResolvedValue(true);

    const request = new Request(
      "http://localhost/api/integrations/mixradius/accounts/config-1",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          isActive: true,
        }),
      },
    );

    await (
      PUT as unknown as (
        req: Request,
      ) => Promise<{ success: boolean; error?: string; status?: number }>
    )(request);

    expect(mockUpdateConfig).toHaveBeenCalledWith(
      "config-1",
      { isActive: true },
      "tenant-1",
    );
  });

  it("scopes DELETE by tenantId for non-superadmin", async () => {
    mockIsSuperAdmin.mockReturnValue(false);
    mockCanAccess.mockResolvedValue(true);

    const request = new Request(
      "http://localhost/api/integrations/mixradius/accounts/config-1",
      {
        method: "DELETE",
      },
    );

    const response = await (
      DELETE as unknown as (
        req: Request,
      ) => Promise<{ success: boolean; error?: string; status?: number }>
    )(request);

    expect(mockDeleteConfig).toHaveBeenCalledWith("config-1", "tenant-1");
    expect(response.success).toBe(true);
  });
});
