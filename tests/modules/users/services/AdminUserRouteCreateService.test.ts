import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  checkSiteRestriction: vi.fn(),
  getTenantAdminRoleId: vi.fn(),
  initializeUserQuotas: vi.fn(),
  sitesCount: vi.fn(),
}));

vi.mock("@/modules/roles", () => ({
  checkSiteRestriction: mockFns.checkSiteRestriction,
}));

vi.mock("@/modules/mitra", () => ({
  getTenantAdminRoleId: mockFns.getTenantAdminRoleId,
}));

vi.mock("@/modules/attendance", () => ({
  AdminLeaveBalanceRouteService: class {
    initializeUserQuotas = mockFns.initializeUserQuotas;
  },
}));

vi.mock("@/modules/database", () => ({
  prismaAuth: {
    sites: {
      count: mockFns.sitesCount,
    },
  },
}));

import type { IUserRepository } from "@/modules/users/domain/ports/IUserRepository";
import { AdminUserRouteCreateService } from "@/modules/users/services/admin-user-route.create";
import type {
  AdminSession,
  CreateAdminUserInput,
} from "@/modules/users/services/AdminUserRouteService.types";
import { UserService } from "@/modules/users/services/UserService";

describe("AdminUserRouteCreateService", () => {
  let service: AdminUserRouteCreateService;
  let repository: IUserRepository;

  const createPayload = (
    overrides: Partial<CreateAdminUserInput> = {},
  ): CreateAdminUserInput => ({
    email: "new.user@example.com",
    password: "secret123",
    roleId: "role-admin",
    tenantId: "tenant-payload",
    ...overrides,
  });

  const createSession = (
    overrides: Partial<AdminSession["user"]> = {},
  ): AdminSession =>
    ({
      user: {
        id: "admin-1",
        isSuperAdmin: false,
        permissions: ["users:create"],
        ...overrides,
      },
    }) as AdminSession;

  beforeEach(() => {
    vi.clearAllMocks();

    repository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByIdWithRelations: vi.fn(),
      findByEmail: vi.fn(),
      findUploadPermissionContextById: vi.fn(),
      create: vi.fn(),
      createWithSites: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      syncUserSites: vi.fn(),
      updateWorkingHours: vi.fn(),
    } as unknown as IUserRepository;

    service = new AdminUserRouteCreateService(repository);

    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: false,
      primarySiteId: null,
      siteIds: [],
    });
    mockFns.getTenantAdminRoleId.mockResolvedValue(undefined);
    mockFns.sitesCount.mockResolvedValue(0);
  });

  it("memaksa non-superadmin memakai tenant dari session saat payload tenant berbeda", async () => {
    const createUserSpy = vi
      .spyOn(UserService.prototype, "createUser")
      .mockResolvedValue({ id: "user-1" } as never);

    await service.createUser(
      createSession({ tenantId: "tenant-session" } as never),
      createPayload({ tenantId: "tenant-other" }),
    );

    expect(createUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-session",
      }),
    );
  });

  it("fail-closed saat non-superadmin tidak punya tenant context", async () => {
    const createUserSpy = vi
      .spyOn(UserService.prototype, "createUser")
      .mockResolvedValue({ id: "user-1" } as never);

    await expect(
      service.createUser(
        createSession(),
        createPayload({ tenantId: undefined }),
      ),
    ).rejects.toThrow("Tenant context wajib tersedia");

    expect(createUserSpy).not.toHaveBeenCalled();
  });

  it("tetap mengizinkan superadmin meneruskan tenant dari payload", async () => {
    const createUserSpy = vi
      .spyOn(UserService.prototype, "createUser")
      .mockResolvedValue({ id: "user-1" } as never);

    await service.createUser(
      createSession({ isSuperAdmin: true, tenantId: null } as never),
      createPayload({ tenantId: "tenant-superadmin" }),
    );

    expect(createUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-superadmin",
      }),
    );
  });

  it("menolak create user dengan siteId lintas tenant", async () => {
    mockFns.sitesCount.mockResolvedValue(0);

    await expect(
      service.createUser(
        createSession({ tenantId: "tenant-session" } as never),
        createPayload({ siteId: "site-other-tenant" }),
      ),
    ).rejects.toThrow("Site tidak ditemukan di tenant ini");

    expect(mockFns.sitesCount).toHaveBeenCalledWith({
      where: { id: "site-other-tenant", tenantId: "tenant-session" },
    });
  });

  it("menolak create user dengan userSites lintas tenant", async () => {
    mockFns.sitesCount.mockResolvedValue(1);

    await expect(
      service.createUser(
        createSession({ tenantId: "tenant-session" } as never),
        createPayload({
          userSites: [
            { siteId: "site-valid", isPrimary: true },
            { siteId: "site-invalid" },
          ],
        }),
      ),
    ).rejects.toThrow("Satu atau lebih site tidak ditemukan di tenant ini");

    expect(mockFns.sitesCount).toHaveBeenCalledWith({
      where: {
        id: { in: ["site-valid", "site-invalid"] },
        tenantId: "tenant-session",
      },
    });
  });
});
