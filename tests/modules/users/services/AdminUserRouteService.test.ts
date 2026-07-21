import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  checkSiteRestriction: vi.fn(),
  canAccessSite: vi.fn(),
}));

vi.mock("@/modules/roles", () => ({
  checkSiteRestriction: mockFns.checkSiteRestriction,
  canAccessSite: mockFns.canAccessSite,
}));

// AdminUserRouteCreateService di-instantiate oleh AdminUserRouteService constructor.
// Stub agar tidak ikut mempengaruhi test update/delete/list.
vi.mock("@/modules/users/services/admin-user-route.create", () => ({
  AdminUserRouteCreateService: class {
    createUser = vi.fn();
  },
}));

import type { IUserRepository } from "@/modules/users/domain/ports/IUserRepository";
import { AdminUserRouteService } from "@/modules/users/services/AdminUserRouteService";
import { AdminUserRouteUpdateService } from "@/modules/users/services/admin-user-route.update";
import type {
  AdminSession,
  UpdateUserPayload,
} from "@/modules/users/services/AdminUserRouteService.types";

describe("AdminUserRouteService", () => {
  let service: AdminUserRouteService;
  let repository: IUserRepository;

  const createSession = (
    overrides: Partial<AdminSession["user"]> = {},
  ): AdminSession =>
    ({
      user: {
        id: "admin-1",
        isSuperAdmin: false,
        tenantId: "tenant-admin",
        permissions: ["users:update"],
        ...overrides,
      },
    }) as AdminSession;

  beforeEach(() => {
    vi.clearAllMocks();

    repository = {
      findAll: vi.fn().mockResolvedValue({
        data: [],
        total: 0,
        active: 0,
        inactive: 0,
      }),
      findById: vi.fn(),
      findByIdWithRelations: vi.fn(),
      findByEmail: vi.fn(),
      findUploadPermissionContextById: vi.fn(),
      create: vi.fn(),
      createWithSites: vi.fn(),
      update: vi.fn(),
      updateWithSites: vi.fn(),
      delete: vi.fn(),
      syncUserSites: vi.fn(),
      updateWorkingHours: vi.fn(),
      incrementTokenVersion: vi.fn(),
    } as unknown as IUserRepository;

    service = new AdminUserRouteService(repository);

    mockFns.checkSiteRestriction.mockReturnValue({
      isRestricted: false,
      primarySiteId: null,
      siteIds: [],
    });
    mockFns.canAccessSite.mockReturnValue(true);
  });

  describe("getAdminUserById", () => {
    it("mengembalikan 404 saat user tidak ditemukan", async () => {
      vi.mocked(repository.findByIdWithRelations).mockResolvedValueOnce(null);

      const result = await service.getAdminUserById(
        createSession(),
        "missing-user",
        ["users:read"],
      );

      expect(result.ok).toBe(false);
      expect(result).toMatchObject({ error: { code: 404 } });
    });

    it("menolak user lain tanpa permission users:read", async () => {
      vi.mocked(repository.findByIdWithRelations).mockResolvedValueOnce({
        id: "other-user",
        siteId: null,
      } as never);

      const result = await service.getAdminUserById(
        createSession(),
        "other-user",
        [],
      );

      expect(result.ok).toBe(false);
      expect(result).toMatchObject({ error: { code: 403 } });
    });

    it("mengizinkan user membaca profilnya sendiri tanpa users:read", async () => {
      vi.mocked(repository.findByIdWithRelations).mockResolvedValueOnce({
        id: "admin-1",
        email: "admin@example.com",
        siteId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const result = await service.getAdminUserById(
        createSession(),
        "admin-1",
        [],
      );

      expect(result.ok).toBe(true);
    });

    it("menolak akses user di site lain saat admin site-restricted", async () => {
      vi.mocked(repository.findByIdWithRelations).mockResolvedValueOnce({
        id: "user-remote",
        siteId: "site-other",
      } as never);
      mockFns.canAccessSite.mockReturnValueOnce(false);

      const result = await service.getAdminUserById(
        createSession(),
        "user-remote",
        ["users:read"],
      );

      expect(result.ok).toBe(false);
      expect(result).toMatchObject({ error: { code: 403 } });
    });
  });

  describe("updateAdminUser", () => {
    const basePayload: UpdateUserPayload = { name: "New Name" };

    it("mengembalikan 404 saat user target tidak ditemukan", async () => {
      vi.mocked(repository.findById).mockResolvedValueOnce(null);

      const result = await service.updateAdminUser(
        createSession(),
        "missing",
        basePayload,
      );

      expect(result.ok).toBe(false);
      expect(result).toMatchObject({ error: { code: 404 } });
    });

    it("meneruskan error dari validateUpdate apa adanya", async () => {
      vi.mocked(repository.findById).mockResolvedValueOnce({
        id: "user-1",
      } as never);

      vi.spyOn(
        AdminUserRouteUpdateService.prototype,
        "validateUpdate",
      ).mockReturnValue({
        ok: false,
        error: { code: 403, message: "Tidak dapat mengubah role sendiri" },
      });

      const result = await service.updateAdminUser(
        createSession({ id: "user-1" } as never),
        "user-1",
        { roleId: "role-other" },
      );

      expect(result.ok).toBe(false);
      expect(result).toMatchObject({
        error: { code: 403, message: expect.stringContaining("role sendiri") },
      });
    });

    it("memanggil persistUpdate dan runAfterUpdate saat payload valid", async () => {
      vi.mocked(repository.findById).mockResolvedValueOnce({
        id: "user-1",
      } as never);

      vi.spyOn(
        AdminUserRouteUpdateService.prototype,
        "validateUpdate",
      ).mockReturnValue({ ok: true, data: null });
      vi.spyOn(
        AdminUserRouteUpdateService.prototype,
        "buildUpdateData",
      ).mockResolvedValue({ ok: true, data: { name: "New Name" } as never });
      const persistUpdate = vi
        .spyOn(AdminUserRouteUpdateService.prototype, "persistUpdate")
        .mockResolvedValue(undefined);
      const runAfterUpdate = vi
        .spyOn(AdminUserRouteUpdateService.prototype, "runAfterUpdate")
        .mockResolvedValue(undefined);

      const result = await service.updateAdminUser(
        createSession(),
        "user-1",
        basePayload,
      );

      expect(result.ok).toBe(true);
      expect(persistUpdate).toHaveBeenCalled();
      expect(runAfterUpdate).toHaveBeenCalled();
    });
  });

  describe("deleteAdminUser", () => {
    it("menolak self-delete", async () => {
      const result = await service.deleteAdminUser(
        createSession({ id: "admin-1" }),
        "admin-1",
      );

      expect(result.ok).toBe(false);
      expect(result).toMatchObject({
        error: { code: 400, message: "Tidak dapat menghapus akun sendiri" },
      });
      expect(repository.findById).not.toHaveBeenCalled();
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it("mengembalikan 404 saat user target tidak ada", async () => {
      vi.mocked(repository.findById).mockResolvedValueOnce(null);

      const result = await service.deleteAdminUser(createSession(), "missing");

      expect(result.ok).toBe(false);
      expect(result).toMatchObject({ error: { code: 404 } });
    });

    it("menolak delete user di luar site saat admin site-restricted", async () => {
      vi.mocked(repository.findById).mockResolvedValueOnce({
        id: "user-remote",
        siteId: "site-other",
      } as never);
      mockFns.checkSiteRestriction.mockReturnValueOnce({
        isRestricted: true,
        primarySiteId: "site-mine",
        siteIds: ["site-mine"],
      });
      mockFns.canAccessSite.mockReturnValueOnce(false);

      const result = await service.deleteAdminUser(
        createSession(),
        "user-remote",
      );

      expect(result.ok).toBe(false);
      expect(result).toMatchObject({ error: { code: 403 } });
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it("menghapus user saat admin berada di site yang sama", async () => {
      vi.mocked(repository.findById).mockResolvedValueOnce({
        id: "user-local",
        siteId: "site-mine",
      } as never);
      vi.mocked(repository.delete).mockResolvedValueOnce({
        id: "user-local",
        name: "Local User",
      } as never);
      mockFns.checkSiteRestriction.mockReturnValueOnce({
        isRestricted: true,
        primarySiteId: "site-mine",
        siteIds: ["site-mine"],
      });
      mockFns.canAccessSite.mockReturnValueOnce(true);

      const result = await service.deleteAdminUser(
        createSession(),
        "user-local",
      );

      expect(result.ok).toBe(true);
      expect(result).toMatchObject({
        data: { deletedUserName: "Local User" },
      });
      expect(repository.delete).toHaveBeenCalledWith("user-local");
    });
  });

  describe("forceLogoutUser", () => {
    it("menolak force logout diri sendiri", async () => {
      const result = await service.forceLogoutUser(
        createSession({ id: "admin-1" }),
        "admin-1",
      );
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({ error: { code: 400 } });
      expect(repository.incrementTokenVersion).not.toHaveBeenCalled();
    });

    it("menolak force logout user di luar site saat restricted", async () => {
      vi.mocked(repository.findById).mockResolvedValueOnce({
        id: "user-remote",
        siteId: "site-other",
        tenantId: "tenant-admin",
      } as never);
      mockFns.checkSiteRestriction.mockReturnValueOnce({
        isRestricted: true,
        primarySiteId: "site-mine",
        siteIds: ["site-mine"],
      });
      mockFns.canAccessSite.mockReturnValueOnce(false);

      const result = await service.forceLogoutUser(
        createSession({ tenantId: "tenant-admin" }),
        "user-remote",
      );

      expect(result.ok).toBe(false);
      expect(result).toMatchObject({ error: { code: 403 } });
      expect(repository.incrementTokenVersion).not.toHaveBeenCalled();
    });

    it("menolak force logout user tenant berbeda", async () => {
      vi.mocked(repository.findById).mockResolvedValueOnce({
        id: "user-x",
        siteId: "site-mine",
        tenantId: "tenant-other",
      } as never);

      const result = await service.forceLogoutUser(
        createSession({ tenantId: "tenant-admin" }),
        "user-x",
      );

      expect(result.ok).toBe(false);
      expect(result).toMatchObject({ error: { code: 403 } });
      expect(repository.incrementTokenVersion).not.toHaveBeenCalled();
    });

    it("force logout sukses saat site accessible", async () => {
      vi.mocked(repository.findById).mockResolvedValueOnce({
        id: "user-local",
        siteId: "site-mine",
        tenantId: "tenant-admin",
      } as never);
      vi.mocked(repository.incrementTokenVersion).mockResolvedValueOnce({
        id: "user-local",
        name: "Local",
        tokenVersion: 3,
      });
      mockFns.checkSiteRestriction.mockReturnValueOnce({
        isRestricted: true,
        primarySiteId: "site-mine",
        siteIds: ["site-mine"],
      });
      mockFns.canAccessSite.mockReturnValueOnce(true);

      const result = await service.forceLogoutUser(
        createSession({ tenantId: "tenant-admin" }),
        "user-local",
      );

      expect(result.ok).toBe(true);
      expect(result).toMatchObject({
        data: { id: "user-local", tokenVersion: 3 },
      });
      expect(repository.incrementTokenVersion).toHaveBeenCalledWith(
        "user-local",
      );
    });
  });

  describe("getAdminUsers tenant filtering", () => {
    it("tidak meneruskan tenant query saat user bukan superadmin", async () => {
      const result = await service.getAdminUsers(
        createSession({ tenantId: "tenant-session" } as never),
        { tenantId: "tenant-requested" },
        ["users:read"],
      );

      expect(result.meta.total).toBe(0);
      // Tenant context yang dipakai adalah tenant-session, bukan tenant-requested.
      // Kita konfirmasi via repository.findAll args.
      expect(repository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "tenant-session" }),
      );
    });

    it("mengizinkan superadmin memakai tenant dari query", async () => {
      const result = await service.getAdminUsers(
        createSession({ isSuperAdmin: true, tenantId: null } as never),
        { tenantId: "tenant-superadmin-pick" },
        ["users:read"],
      );

      expect(result.meta.total).toBe(0);
      expect(repository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "tenant-superadmin-pick" }),
      );
    });
  });
});
