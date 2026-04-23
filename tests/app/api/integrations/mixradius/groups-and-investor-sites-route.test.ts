import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUserPermissions,
  mockIsSuperAdmin,
  mockSessionUser,
  mockGetOwnerGroups,
  mockCreateOwnerGroup,
  mockUpdateOwnerGroup,
  mockDeleteOwnerGroup,
  mockFindManyInvestorSites,
  mockFindUniqueInvestorSite,
  mockCreateInvestorSite,
  mockUpdateInvestorSite,
  mockDeleteInvestorSite,
  mockHasPermission,
} = vi.hoisted(() => ({
  mockGetUserPermissions: vi.fn(),
  mockIsSuperAdmin: vi.fn(),
  mockSessionUser: { id: "user-1", tenantId: "tenant-1" as string | undefined },
  mockGetOwnerGroups: vi.fn(),
  mockCreateOwnerGroup: vi.fn(),
  mockUpdateOwnerGroup: vi.fn(),
  mockDeleteOwnerGroup: vi.fn(),
  mockFindManyInvestorSites: vi.fn(),
  mockFindUniqueInvestorSite: vi.fn(),
  mockCreateInvestorSite: vi.fn(),
  mockUpdateInvestorSite: vi.fn(),
  mockDeleteInvestorSite: vi.fn(),
  mockHasPermission: vi.fn(),
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
        params: { id: "entity-1" },
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
    badRequest: (message = "Bad request") => ({
      success: false,
      error: message,
      status: 400,
    }),
    notFound: (message = "Not found") => ({
      success: false,
      error: message,
      status: 404,
    }),
    internalError: (message = "Internal error") => ({
      success: false,
      error: message,
      status: 500,
    }),
  },
  ErrorCodes: {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    INVALID_STATUS: "INVALID_STATUS",
  },
}));

vi.mock("@/lib/auth", () => ({
  getUserPermissions: mockGetUserPermissions,
  isSuperAdmin: mockIsSuperAdmin,
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("@/modules/roles", () => ({
  SiteService: class {
    async getSites(): Promise<Array<{ id: string; name: string }>> {
      return [];
    }
  },
}));

vi.mock("@/modules/database", () => ({
  prismaBilling: {
    mixRadiusInvestorSite: {
      findMany: mockFindManyInvestorSites,
      findUnique: mockFindUniqueInvestorSite,
      create: mockCreateInvestorSite,
      update: mockUpdateInvestorSite,
      delete: mockDeleteInvestorSite,
    },
  },
}));

vi.mock("@/modules/integrations", () => ({
  getMixRadiusService: () => ({
    getOwnerGroups: mockGetOwnerGroups,
    createOwnerGroup: mockCreateOwnerGroup,
    updateOwnerGroup: mockUpdateOwnerGroup,
    deleteOwnerGroup: mockDeleteOwnerGroup,
  }),
}));

import { GET as GET_GROUPS } from "@/app/api/integrations/mixradius/groups/route";
import {
  DELETE as DELETE_GROUP,
  PUT as PUT_GROUP,
} from "@/app/api/integrations/mixradius/groups/[id]/route";
import {
  GET as GET_INVESTOR_SITES,
  POST as POST_INVESTOR_SITES,
} from "@/app/api/integrations/mixradius/investor-sites/route";
import {
  DELETE as DELETE_INVESTOR_SITE,
  GET as GET_INVESTOR_SITE,
  PUT as PUT_INVESTOR_SITE,
} from "@/app/api/integrations/mixradius/investor-sites/[id]/route";

describe("MixRadius groups and investor sites routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser.tenantId = "tenant-1";
    mockIsSuperAdmin.mockReturnValue(false);
    mockGetUserPermissions.mockResolvedValue([
      "mixradius_sites:read",
      "mixradius_sites:create",
      "mixradius_sites:update",
      "mixradius_sites:delete",
      "mixradius:update",
      "mixradius:delete",
    ]);
    mockHasPermission.mockResolvedValue(true);
    mockGetOwnerGroups.mockResolvedValue([]);
    mockCreateOwnerGroup.mockResolvedValue({ id: "entity-1", name: "Site A" });
    mockUpdateOwnerGroup.mockResolvedValue({ id: "entity-1", name: "Site A" });
    mockDeleteOwnerGroup.mockResolvedValue(undefined);
    mockFindManyInvestorSites.mockResolvedValue([]);
    mockFindUniqueInvestorSite.mockResolvedValue({
      id: "entity-1",
      name: "Investor A",
    });
    mockCreateInvestorSite.mockResolvedValue({
      id: "entity-1",
      name: "Investor A",
    });
    mockUpdateInvestorSite.mockResolvedValue({
      id: "entity-1",
      name: "Investor A",
    });
    mockDeleteInvestorSite.mockResolvedValue(undefined);
  });

  it("returns 400 for groups GET when non-superadmin has no tenantId", async () => {
    mockSessionUser.tenantId = undefined;

    const response = await (
      GET_GROUPS as unknown as (
        req: Request,
      ) => Promise<{ success: boolean; status?: number; error?: string }>
    )(new Request("http://localhost/api/integrations/mixradius/groups"));

    expect(response.success).toBe(false);
    expect(response.status).toBe(400);
    expect(mockGetOwnerGroups).not.toHaveBeenCalled();
  });

  it("passes tenantId when creating owner group", async () => {
    await (
      POST_INVESTOR_SITES as unknown as (
        req: Request,
      ) => Promise<{ success: boolean }>
    )(
      new Request(
        "http://localhost/api/integrations/mixradius/investor-sites",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Investor A", owners: ["Owner 1"] }),
        },
      ),
    );

    expect(mockCreateInvestorSite).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-1" }),
    });
  });

  it("filters investor sites GET by tenantId for non-superadmin", async () => {
    await (
      GET_INVESTOR_SITES as unknown as (
        req: Request,
      ) => Promise<{ success: boolean }>
    )(
      new Request("http://localhost/api/integrations/mixradius/investor-sites"),
    );

    expect(mockFindManyInvestorSites).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-1" } }),
    );
  });

  it("filters investor site detail by tenantId for non-superadmin", async () => {
    await (
      GET_INVESTOR_SITE as unknown as (
        req: Request,
      ) => Promise<{ success: boolean }>
    )(
      new Request(
        "http://localhost/api/integrations/mixradius/investor-sites/entity-1",
      ),
    );

    expect(mockFindUniqueInvestorSite).toHaveBeenCalledWith({
      where: { id: "entity-1", tenantId: "tenant-1" },
    });
  });

  it("updates investor site by id and tenantId for non-superadmin", async () => {
    await (
      PUT_INVESTOR_SITE as unknown as (
        req: Request,
      ) => Promise<{ success: boolean }>
    )(
      new Request(
        "http://localhost/api/integrations/mixradius/investor-sites/entity-1",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Investor A",
            owners: ["Owner 1"],
            isActive: true,
          }),
        },
      ),
    );

    expect(mockUpdateInvestorSite).toHaveBeenCalledWith({
      where: { id: "entity-1", tenantId: "tenant-1" },
      data: expect.objectContaining({ name: "Investor A" }),
    });
  });

  it("deletes investor site by id and tenantId for non-superadmin", async () => {
    await (
      DELETE_INVESTOR_SITE as unknown as (
        req: Request,
      ) => Promise<{ success: boolean }>
    )(
      new Request(
        "http://localhost/api/integrations/mixradius/investor-sites/entity-1",
        { method: "DELETE" },
      ),
    );

    expect(mockDeleteInvestorSite).toHaveBeenCalledWith({
      where: { id: "entity-1", tenantId: "tenant-1" },
    });
  });

  it("updates owner group by id and tenantId for non-superadmin", async () => {
    await (
      PUT_GROUP as unknown as (req: Request) => Promise<{ success: boolean }>
    )(
      new Request(
        "http://localhost/api/integrations/mixradius/groups/entity-1",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Group A",
            owners: ["Owner 1"],
            isActive: true,
          }),
        },
      ),
    );

    expect(mockUpdateOwnerGroup).toHaveBeenCalledWith(
      "entity-1",
      expect.objectContaining({ tenantId: "tenant-1" }),
    );
  });

  it("deletes owner group by id and tenantId for non-superadmin", async () => {
    await (
      DELETE_GROUP as unknown as (req: Request) => Promise<{ success: boolean }>
    )(
      new Request(
        "http://localhost/api/integrations/mixradius/groups/entity-1",
        { method: "DELETE" },
      ),
    );

    expect(mockDeleteOwnerGroup).toHaveBeenCalledWith("entity-1", "tenant-1");
  });
});
