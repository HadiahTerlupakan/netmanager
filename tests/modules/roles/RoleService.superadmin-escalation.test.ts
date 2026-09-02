import { describe, expect, it, vi, beforeEach } from "vitest";
import { RoleService } from "@/modules/roles/services/RoleService";

vi.mock("@/lib/auth", () => ({
  invalidateRolePermissionCache: vi.fn(),
  invalidatePermissionCache: vi.fn(),
}));

const MAIN_TENANT = "main-tenant";
vi.mock("@/lib/tenant-constants", () => ({
  MAIN_TENANT_ID: "main-tenant",
  isMainTenant: (tenantId: string | null) => tenantId === "main-tenant",
}));

function createService(currentRoleName = "Teknisi") {
  const roleRepository = {
    findById: vi.fn().mockResolvedValue({
      id: "role-1",
      name: currentRoleName,
      isSuperAdmin: false,
      permissions: [],
    }),
    findByName: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockImplementation(async (id: string, data: unknown) => ({
      id,
      ...(data as object),
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: [],
    })),
    create: vi.fn().mockImplementation(async (data: unknown) => ({
      id: "role-new",
      ...(data as object),
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: [],
    })),
  };
  const permissionRepository = {
    findMany: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue([]),
  };
  return {
    service: new RoleService(
      roleRepository as never,
      permissionRepository as never,
    ),
    roleRepository,
  };
}

const baseInput = { name: "Teknisi", permissions: [] as string[] };

describe("eskalasi superadmin lewat nama role", () => {
  beforeEach(() => vi.clearAllMocks());

  // Regresi: isSuperAdminRole() menentukan superadmin dari STRING nama role,
  // sementara guard rename hanya mencegah role SUPER_ADMIN di-rename KELUAR.
  // Rename role biasa MASUK ke nama itu tidak dijaga sama sekali, sehingga
  // pemegang roles:update bisa mengangkat dirinya jadi superadmin.
  it.each(["SUPER_ADMIN", "Super Admin"])(
    "menolak rename role menjadi %s oleh aktor non-superadmin",
    async (magicName) => {
      const { service, roleRepository } = createService();

      await expect(
        service.updateRoleWithPolicy(
          "role-1",
          { ...baseInput, name: magicName },
          { tenantId: MAIN_TENANT, actorIsSuperAdmin: false },
        ),
      ).rejects.toThrow();
      expect(roleRepository.update).not.toHaveBeenCalled();
    },
  );

  it.each(["SUPER_ADMIN", "Super Admin"])(
    "menolak pembuatan role bernama %s oleh aktor non-superadmin",
    async (magicName) => {
      const { service, roleRepository } = createService();

      await expect(
        service.createRoleWithPolicy(
          { ...baseInput, name: magicName },
          { tenantId: MAIN_TENANT, actorIsSuperAdmin: false },
        ),
      ).rejects.toThrow();
      expect(roleRepository.create).not.toHaveBeenCalled();
    },
  );

  // Jalur boolean: sebelumnya cukup berada di tenant utama, tanpa syarat
  // aktornya sendiri superadmin.
  it("menolak set isSuperAdmin oleh aktor non-superadmin walau di tenant utama", async () => {
    const { service, roleRepository } = createService();

    await expect(
      service.updateRoleWithPolicy(
        "role-1",
        { ...baseInput, isSuperAdmin: true },
        { tenantId: MAIN_TENANT, actorIsSuperAdmin: false },
      ),
    ).rejects.toThrow();
    expect(roleRepository.update).not.toHaveBeenCalled();
  });

  it("mengizinkan superadmin di tenant utama mengelola role superadmin", async () => {
    const { service, roleRepository } = createService();

    await service.updateRoleWithPolicy(
      "role-1",
      { ...baseInput, isSuperAdmin: true },
      { tenantId: MAIN_TENANT, actorIsSuperAdmin: true },
    );

    expect(roleRepository.update).toHaveBeenCalled();
  });

  it("tetap menolak superadmin dari tenant non-utama", async () => {
    const { service } = createService();

    await expect(
      service.updateRoleWithPolicy(
        "role-1",
        { ...baseInput, name: "SUPER_ADMIN" },
        { tenantId: "tenant-b", actorIsSuperAdmin: true },
      ),
    ).rejects.toThrow();
  });

  it("tidak mengganggu rename biasa", async () => {
    const { service, roleRepository } = createService();

    await service.updateRoleWithPolicy(
      "role-1",
      { ...baseInput, name: "Teknisi Lapangan" },
      { tenantId: "tenant-b", actorIsSuperAdmin: false },
    );

    expect(roleRepository.update).toHaveBeenCalled();
  });
});
