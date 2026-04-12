import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateConfig,
  mockUpdateConfig,
  mockLogActivity,
  mockIsSuperAdmin,
  mockGetUserPermissions,
} = vi.hoisted(() => ({
  mockCreateConfig: vi.fn(),
  mockUpdateConfig: vi.fn(),
  mockLogActivity: vi.fn(),
  mockIsSuperAdmin: vi.fn(),
  mockGetUserPermissions: vi.fn(),
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
        session: { user: { id: "user-1", tenantId: "tenant-1" } },
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
  getUserPermissions: mockGetUserPermissions,
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
  mixRadiusConfigRepo: {
    createConfig: mockCreateConfig,
    updateConfig: mockUpdateConfig,
  },
  IntegrationFactory: {
    createMixRadiusConfig: mockCreateMixRadiusConfig,
    validateUrl: mockValidateUrl,
  },
}));

import { POST } from "@/app/api/integrations/mixradius/accounts/route";
import { PUT } from "@/app/api/integrations/mixradius/accounts/[id]/route";

describe("MixRadius accounts routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdmin.mockReturnValue(true);
    mockGetUserPermissions.mockResolvedValue([]);
    mockCreateConfig.mockResolvedValue({
      id: "config-1",
      apiUrl: "https://mixradius.example.com",
    });
    mockUpdateConfig.mockResolvedValue({
      id: "config-1",
      apiUrl: "https://mixradius.example.com",
    });
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
      expect.objectContaining({
        apiUrl: "https://mixradius.example.com",
        isDefault: true,
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
        apiUrl: "https://mixradius.example.com",
        username: "admin",
      }),
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

    expect(mockUpdateConfig).toHaveBeenCalledWith("config-1", {
      isDefault: true,
    });
    expect(response.success).toBe(true);
  });
});
