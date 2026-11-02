import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Admin multi-site dengan `users:site_only` dulu hanya dihitung memakai site
 * utamanya: daftar user menyaring ke satu site, create/update menolak site
 * keduanya. Di sini `@/modules/roles` TIDAK di-mock — lingkupnya dibaca dari
 * izin dan `siteIds` sesi seperti di produksi.
 */

vi.mock("@/modules/mitra", () => ({ getTenantAdminRoleId: vi.fn() }));

vi.mock("@/modules/attendance", () => ({
  AdminLeaveBalanceRouteService: class {
    initializeUserQuotas = vi.fn();
  },
}));

// Semua site yang diminta dianggap ada di tenant: yang diuji di sini lingkup
// site admin, bukan validasi tenant.
vi.mock("@/modules/database", () => ({
  prisma: {},
  prismaAuth: {
    sites: {
      count: vi.fn(async ({ where }: { where: { id: unknown } }) =>
        typeof where.id === "string"
          ? 1
          : (where.id as { in: string[] }).in.length,
      ),
    },
  },
}));

import type { IUserRepository } from "@/modules/users/domain/ports/IUserRepository";
import {
  canAccessUserSite,
  validateScopedUpdate,
} from "@/modules/users/services/AdminUserRouteService.helpers";
import { AdminUserRouteService } from "@/modules/users/services/AdminUserRouteService";
import { AdminUserRouteCreateService } from "@/modules/users/services/admin-user-route.create";
import type { AdminSession } from "@/modules/users/services/AdminUserRouteService.types";
import type { UserEntity } from "@/modules/users/domain/entities/UserEntity";
import { UserService } from "@/modules/users/services/UserService";

const SESI_MULTI_SITE = {
  user: {
    id: "admin-1",
    isSuperAdmin: false,
    tenantId: "t-1",
    siteId: "site-a",
    primarySiteId: "site-a",
    siteIds: ["site-a", "site-b"],
    permissions: ["users:read", "users:update", "users:site_only"],
  },
} as unknown as AdminSession;

const SESI_TANPA_BATAS = {
  user: {
    id: "admin-1",
    isSuperAdmin: false,
    tenantId: "t-1",
    siteId: "site-a",
    siteIds: ["site-a"],
    permissions: ["users:read", "users:update"],
  },
} as unknown as AdminSession;

const SESI_SUPER_ADMIN = {
  user: { id: "sa-1", isSuperAdmin: true, permissions: ["users:site_only"] },
} as unknown as AdminSession;

function userDengan(
  siteId: string | null,
  userSiteIds: string[] = [],
): UserEntity {
  return {
    id: "user-1",
    tenantId: "t-1",
    siteId,
    userSites: userSiteIds.map((id) => ({
      id: `us-${id}`,
      siteId: id,
      isPrimary: id === siteId,
      site: { id, code: id, name: id },
    })),
  } as unknown as UserEntity;
}

function buatRepository(): IUserRepository {
  return {
    findAll: vi
      .fn()
      .mockResolvedValue({ data: [], total: 0, active: 0, inactive: 0 }),
    findById: vi.fn(),
    findByIdWithRelations: vi.fn(),
    delete: vi.fn().mockResolvedValue({ id: "user-1", name: "U" }),
    incrementTokenVersion: vi
      .fn()
      .mockResolvedValue({ id: "user-1", name: "U", tokenVersion: 2 }),
  } as unknown as IUserRepository;
}

describe("daftar user — admin multi-site", () => {
  it("menyaring ke SEMUA site admin, bukan hanya site utama", async () => {
    const repository = buatRepository();
    const service = new AdminUserRouteService(repository);

    await service.getAdminUsers(SESI_MULTI_SITE, {}, [
      "users:read",
      "users:site_only",
    ]);

    expect(repository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ siteIds: ["site-a", "site-b"] }),
    );
  });

  it("admin tanpa pembatasan tidak disaring per site", async () => {
    const repository = buatRepository();
    const service = new AdminUserRouteService(repository);

    await service.getAdminUsers(SESI_TANPA_BATAS, {}, ["users:read"]);

    expect(repository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ siteIds: undefined }),
    );
  });

  it("wildcard '*' tidak dianggap dibatasi", async () => {
    const repository = buatRepository();
    const service = new AdminUserRouteService(repository);

    await service.getAdminUsers(SESI_TANPA_BATAS, {}, ["*"]);

    expect(repository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ siteIds: undefined }),
    );
  });
});

describe("canAccessUserSite — konsisten dengan filter daftar", () => {
  it("meloloskan user di site kedua admin", () => {
    expect(canAccessUserSite(SESI_MULTI_SITE, userDengan("site-b"))).toBe(true);
  });

  it("meloloskan user yang site utamanya lain tetapi userSites-nya di site admin", () => {
    expect(
      canAccessUserSite(
        SESI_MULTI_SITE,
        userDengan("site-x", ["site-x", "site-b"]),
      ),
    ).toBe(true);
  });

  it("menolak user di luar seluruh site admin", () => {
    expect(
      canAccessUserSite(SESI_MULTI_SITE, userDengan("site-x", ["site-x"])),
    ).toBe(false);
  });

  it("menolak user tanpa site sama sekali (gagal tertutup)", () => {
    expect(canAccessUserSite(SESI_MULTI_SITE, userDengan(null))).toBe(false);
  });

  it("admin tanpa pembatasan dan super admin tetap bisa mengurus user tanpa site", () => {
    expect(canAccessUserSite(SESI_TANPA_BATAS, userDengan(null))).toBe(true);
    expect(canAccessUserSite(SESI_SUPER_ADMIN, userDengan(null))).toBe(true);
  });
});

describe("aksi tunggal — admin multi-site", () => {
  let repository: IUserRepository;
  let service: AdminUserRouteService;

  beforeEach(() => {
    repository = buatRepository();
    service = new AdminUserRouteService(repository);
  });

  it("detail user di site kedua admin terbuka", async () => {
    vi.mocked(repository.findByIdWithRelations).mockResolvedValueOnce({
      ...userDengan("site-b", ["site-b"]),
      email: "u@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await service.getAdminUserById(SESI_MULTI_SITE, "user-1", [
      "users:read",
    ]);

    expect(result.ok).toBe(true);
  });

  it("hapus user di site kedua admin diizinkan", async () => {
    vi.mocked(repository.findByIdWithRelations).mockResolvedValueOnce(
      userDengan("site-b", ["site-b"]),
    );

    const result = await service.deleteAdminUser(SESI_MULTI_SITE, "user-1");

    expect(result.ok).toBe(true);
    expect(repository.delete).toHaveBeenCalledWith("user-1");
  });

  it("force logout user tanpa site ditolak untuk admin terbatas", async () => {
    vi.mocked(repository.findByIdWithRelations).mockResolvedValueOnce(
      userDengan(null),
    );

    const result = await service.forceLogoutUser(SESI_MULTI_SITE, "user-1");

    expect(result).toMatchObject({ ok: false, error: { code: 403 } });
    expect(repository.incrementTokenVersion).not.toHaveBeenCalled();
  });

  it("update user tanpa site ditolak untuk admin terbatas", async () => {
    vi.mocked(repository.findByIdWithRelations).mockResolvedValueOnce(
      userDengan(null),
    );

    const result = await service.updateAdminUser(SESI_MULTI_SITE, "user-1", {
      name: "Baru",
    });

    expect(result).toMatchObject({ ok: false, error: { code: 403 } });
  });
});

describe("validateScopedUpdate — perubahan site oleh admin multi-site", () => {
  const target = userDengan("site-a", ["site-a"]);

  it("boleh memindahkan user ke site kedua admin", () => {
    expect(
      validateScopedUpdate(SESI_MULTI_SITE, false, target, {
        siteId: "site-b",
        userSites: [{ siteId: "site-b", isPrimary: true }],
      }),
    ).toEqual({ ok: true, data: null });
  });

  it("menolak memindahkan user ke site di luar lingkup", () => {
    expect(
      validateScopedUpdate(SESI_MULTI_SITE, false, target, {
        siteId: "site-x",
      }),
    ).toMatchObject({ ok: false, error: { code: 403 } });
  });

  it("menolak menambah site di luar lingkup lewat userSites", () => {
    expect(
      validateScopedUpdate(SESI_MULTI_SITE, false, target, {
        userSites: [{ siteId: "site-a" }, { siteId: "site-x" }],
      }),
    ).toMatchObject({ ok: false, error: { code: 403 } });
  });

  it("menolak membuat user tanpa site (siteId null / userSites kosong)", () => {
    expect(
      validateScopedUpdate(SESI_MULTI_SITE, false, target, { siteId: null }),
    ).toMatchObject({ ok: false, error: { code: 403 } });
    expect(
      validateScopedUpdate(SESI_MULTI_SITE, false, target, { userSites: [] }),
    ).toMatchObject({ ok: false, error: { code: 403 } });
  });

  it("site di luar lingkup yang SUDAH dimiliki user boleh tetap, tidak boleh dicabut", () => {
    const lintasSite = userDengan("site-a", ["site-a", "site-x"]);
    expect(
      validateScopedUpdate(SESI_MULTI_SITE, false, lintasSite, {
        userSites: [{ siteId: "site-a" }, { siteId: "site-x" }],
      }),
    ).toEqual({ ok: true, data: null });
    expect(
      validateScopedUpdate(SESI_MULTI_SITE, false, lintasSite, {
        userSites: [{ siteId: "site-a" }],
      }),
    ).toMatchObject({ ok: false, error: { code: 403 } });
  });

  // Regresi: site utama legacy di luar lingkup (tidak tercermin di userSites)
  // dulu tidak dihitung, padahal `updateWithSites` menimpa `siteId` dari
  // userSites — admin site-b bisa mencabut site-x milik user.
  it("site utama di luar lingkup juga tidak boleh dicabut lewat userSites", () => {
    const siteUtamaLuar = userDengan("site-x", ["site-b"]);
    expect(
      validateScopedUpdate(SESI_MULTI_SITE, false, siteUtamaLuar, {
        userSites: [{ siteId: "site-b", isPrimary: true }],
      }),
    ).toMatchObject({ ok: false, error: { code: 403 } });
    expect(
      validateScopedUpdate(SESI_MULTI_SITE, false, siteUtamaLuar, {
        userSites: [
          { siteId: "site-x", isPrimary: true },
          { siteId: "site-b" },
        ],
      }),
    ).toEqual({ ok: true, data: null });
  });

  it("admin sendiri pun tidak bisa menambah site di luar lingkupnya", () => {
    expect(
      validateScopedUpdate(SESI_MULTI_SITE, true, target, {
        userSites: [{ siteId: "site-a" }, { siteId: "site-x" }],
      }),
    ).toMatchObject({ ok: false, error: { code: 403 } });
  });

  it("admin tanpa pembatasan bebas mengubah site", () => {
    expect(
      validateScopedUpdate(SESI_TANPA_BATAS, false, target, {
        siteId: "site-x",
        userSites: [],
      }),
    ).toEqual({ ok: true, data: null });
  });
});

describe("create user — admin multi-site", () => {
  const sesiCreate = {
    user: {
      ...SESI_MULTI_SITE.user,
      permissions: ["users:create", "users:site_only"],
    },
  } as unknown as AdminSession;

  let createUser: ReturnType<typeof vi.spyOn>;
  let service: AdminUserRouteCreateService;

  beforeEach(() => {
    vi.restoreAllMocks();
    createUser = vi
      .spyOn(UserService.prototype, "createUser")
      .mockResolvedValue({ id: "new-1", email: "n@example.com" } as never);
    service = new AdminUserRouteCreateService(buatRepository());
  });

  const payload = { email: "n@example.com", password: "secret123" };

  it("boleh membuat user di site kedua admin", async () => {
    await service.createUser(sesiCreate, { ...payload, siteId: "site-b" });

    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "site-b" }),
    );
  });

  it("tanpa siteId, user baru ditaruh di site utama admin", async () => {
    await service.createUser(sesiCreate, payload);

    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "site-a" }),
    );
  });

  it("menolak membuat user di site luar lingkup", async () => {
    await expect(
      service.createUser(sesiCreate, { ...payload, siteId: "site-x" }),
    ).rejects.toThrow("Anda hanya dapat membuat user untuk site Anda");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("menolak userSites di luar lingkup", async () => {
    await expect(
      service.createUser(sesiCreate, {
        ...payload,
        userSites: [
          { siteId: "site-b", isPrimary: true },
          { siteId: "site-x" },
        ],
      }),
    ).rejects.toThrow("di luar scope Anda");
  });

  it("admin terbatas tanpa site tidak bisa membuat user", async () => {
    const tanpaSite = {
      user: {
        ...sesiCreate.user,
        siteId: null,
        primarySiteId: null,
        siteIds: [],
      },
    } as unknown as AdminSession;

    await expect(service.createUser(tanpaSite, payload)).rejects.toThrow(
      "has no site assigned",
    );
  });
});

describe("checkUserReadAccess — performa user per site", () => {
  const IZIN_TERBATAS = ["users:read", "users:site_only"];

  function serviceDengan(target: UserEntity | null) {
    const repository = buatRepository();
    vi.mocked(repository.findByIdWithRelations).mockResolvedValue(target);
    return new AdminUserRouteService(repository);
  }

  it("membuka performa user di site kedua admin", async () => {
    const service = serviceDengan(userDengan("site-b", ["site-b"]));
    await expect(
      service.checkUserReadAccess(SESI_MULTI_SITE, "user-1", IZIN_TERBATAS),
    ).resolves.toEqual({ ok: true, data: null });
  });

  it("menolak performa user di site lain", async () => {
    const service = serviceDengan(userDengan("site-x", ["site-x"]));
    await expect(
      service.checkUserReadAccess(SESI_MULTI_SITE, "user-1", IZIN_TERBATAS),
    ).resolves.toMatchObject({ ok: false, error: { code: 403 } });
  });

  it("menolak performa user tanpa site (gagal tertutup)", async () => {
    const service = serviceDengan(userDengan(null));
    await expect(
      service.checkUserReadAccess(SESI_MULTI_SITE, "user-1", IZIN_TERBATAS),
    ).resolves.toMatchObject({ ok: false, error: { code: 403 } });
  });

  it("izin dibaca dari argumen, bukan dari sesi", async () => {
    const sesiTanpaIzin = {
      user: { ...SESI_MULTI_SITE.user, permissions: [] },
    } as unknown as AdminSession;
    const service = serviceDengan(userDengan("site-x", ["site-x"]));
    await expect(
      service.checkUserReadAccess(sesiTanpaIzin, "user-1", IZIN_TERBATAS),
    ).resolves.toMatchObject({ ok: false, error: { code: 403 } });
  });

  it("akun sendiri selalu boleh tanpa memuat target", async () => {
    const service = serviceDengan(null);
    await expect(
      service.checkUserReadAccess(SESI_MULTI_SITE, "admin-1", []),
    ).resolves.toEqual({ ok: true, data: null });
  });

  it("tanpa users:read ditolak", async () => {
    const service = serviceDengan(userDengan("site-a", ["site-a"]));
    await expect(
      service.checkUserReadAccess(SESI_MULTI_SITE, "user-1", [
        "users:site_only",
      ]),
    ).resolves.toMatchObject({ ok: false, error: { code: 403 } });
  });

  it("target tidak ada atau di tenant lain → 404", async () => {
    await expect(
      serviceDengan(null).checkUserReadAccess(
        SESI_MULTI_SITE,
        "user-1",
        IZIN_TERBATAS,
      ),
    ).resolves.toMatchObject({ ok: false, error: { code: 404 } });
    const tenantLain = {
      ...userDengan("site-a", ["site-a"]),
      tenantId: "t-2",
    } as UserEntity;
    await expect(
      serviceDengan(tenantLain).checkUserReadAccess(
        SESI_MULTI_SITE,
        "user-1",
        IZIN_TERBATAS,
      ),
    ).resolves.toMatchObject({ ok: false, error: { code: 404 } });
  });

  it("admin tanpa pembatasan, wildcard, dan super admin melihat user tanpa site", async () => {
    const tanpaSite = userDengan(null);
    await expect(
      serviceDengan(tanpaSite).checkUserReadAccess(SESI_TANPA_BATAS, "user-1", [
        "users:read",
      ]),
    ).resolves.toEqual({ ok: true, data: null });
    await expect(
      serviceDengan(tanpaSite).checkUserReadAccess(SESI_TANPA_BATAS, "user-1", [
        "*",
      ]),
    ).resolves.toEqual({ ok: true, data: null });
    await expect(
      serviceDengan(tanpaSite).checkUserReadAccess(SESI_SUPER_ADMIN, "user-1", [
        "users:read",
        "users:site_only",
      ]),
    ).resolves.toEqual({ ok: true, data: null });
  });
});
