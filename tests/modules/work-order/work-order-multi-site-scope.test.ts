import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUserProfile: vi.fn() }));

vi.mock(
  "@/modules/work-order/repositories/AdminWorkOrderRouteRepository",
  () => ({
    AdminWorkOrderRouteRepository: class {
      findUserProfile = mocks.findUserProfile;
    },
  }),
);
vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { applyWorkOrderRelationFilters } from "@/modules/work-order/repositories/work-order-query-builders";
import {
  resolveSiteFilter,
  resolveSiteIdList,
} from "@/modules/work-order/repositories/work-order-site-scope";
import {
  getWorkOrderScopeViolation,
  validateWorkOrderAccess,
} from "@/modules/work-order/services/work-order-access";
import { enforceSiteRestriction } from "@/modules/work-order/services/work-order-create-scope";
import { applyWorkOrderListRestrictions } from "@/modules/work-order/services/work-order-service-helpers";
import { AdminWorkOrderRouteService } from "@/modules/work-order/services/AdminWorkOrderRouteService";
import type { CreateWorkOrderInput } from "@/modules/work-order/services/WorkOrderService";

/**
 * Karyawan multi-site (site utama + `userSites`) dulu hanya melihat WO site
 * utamanya di panel web, sementara mobile dan inventory memakai semua
 * site-nya. Lingkup `workorders:site_only` kini memakai seluruh site.
 */

const SITE_ONLY = ["workorders:site_only"];
const SITE_UTAMA = "site-a";
const SITE_KEDUA = "site-b";
const SITE_LAIN = "site-z";

describe("daftar WO web memakai seluruh site pengguna", () => {
  it("mengunci daftar ke semua site userSites", () => {
    const filters = applyWorkOrderListRestrictions({
      filters: {},
      userPermissions: SITE_ONLY,
      userSiteId: SITE_UTAMA,
      userSiteIds: [SITE_UTAMA, SITE_KEDUA],
    });

    expect(filters?.siteIds).toEqual([SITE_UTAMA, SITE_KEDUA]);
  });

  it("jatuh ke site legacy bila userSites kosong", () => {
    const filters = applyWorkOrderListRestrictions({
      filters: {},
      userPermissions: SITE_ONLY,
      userSiteId: SITE_UTAMA,
      userSiteIds: [],
    });

    expect(filters?.siteIds).toEqual([SITE_UTAMA]);
  });

  it("gagal tertutup bila dibatasi tanpa site sama sekali", () => {
    const filters = applyWorkOrderListRestrictions({
      filters: {},
      userPermissions: SITE_ONLY,
      userSiteIds: [],
    });

    expect(filters).toBeNull();
  });

  it("tanpa site_only tidak menambah lingkup site", () => {
    const filters = applyWorkOrderListRestrictions({
      filters: { siteId: SITE_LAIN },
      userPermissions: ["workorders:read"],
      userSiteIds: [SITE_UTAMA],
    });

    expect(filters).toEqual({ siteId: SITE_LAIN });
  });

  it("query daftar menyaring ke seluruh site lingkup", () => {
    const where = {};
    applyWorkOrderRelationFilters(where, {
      siteIds: [SITE_UTAMA, SITE_KEDUA],
    });

    expect(where).toEqual({ siteId: { in: [SITE_UTAMA, SITE_KEDUA] } });
  });
});

describe("filter site pilihan pengguna dipersempit lingkupnya", () => {
  it("site pilihan di dalam lingkup dipakai apa adanya", () => {
    expect(
      resolveSiteFilter({
        siteId: SITE_KEDUA,
        siteIds: [SITE_UTAMA, SITE_KEDUA],
      }),
    ).toBe(SITE_KEDUA);
  });

  it("site pilihan di luar lingkup tidak melebarkan hasil", () => {
    expect(
      resolveSiteFilter({ siteId: SITE_LAIN, siteIds: [SITE_UTAMA] }),
    ).toEqual({ in: [] });
    expect(
      resolveSiteIdList({ siteId: SITE_LAIN, siteIds: [SITE_UTAMA] }),
    ).toEqual([]);
  });

  it("tanpa lingkup, filter pilihan saja yang berlaku", () => {
    expect(resolveSiteFilter({ siteId: SITE_LAIN })).toBe(SITE_LAIN);
    expect(resolveSiteIdList({})).toBeUndefined();
  });
});

describe("akses WO tunggal memakai seluruh site pengguna", () => {
  const multiSiteUser = {
    permissions: SITE_ONLY,
    siteId: SITE_UTAMA,
    siteIds: [SITE_UTAMA, SITE_KEDUA],
  };

  it("WO di site kedua boleh dibuka", () => {
    expect(
      getWorkOrderScopeViolation(
        { siteId: SITE_KEDUA, departmentId: null },
        multiSiteUser,
      ),
    ).toBeNull();
  });

  it("WO di site lain tetap ditolak", () => {
    expect(
      getWorkOrderScopeViolation(
        { siteId: SITE_LAIN, departmentId: null },
        multiSiteUser,
      ),
    ).toBe("Akses ditolak: Site berbeda");
  });

  it("role dengan wildcard * tidak dianggap dibatasi", () => {
    expect(
      getWorkOrderScopeViolation(
        { siteId: SITE_LAIN, departmentId: null },
        { permissions: ["*"], siteId: SITE_UTAMA },
      ),
    ).toBeNull();
  });
});

describe("validateWorkOrderAccess melepas super admin menurut nama role", () => {
  const workOrderSiteLain = {
    id: "wo-1",
    siteId: SITE_LAIN,
    departmentId: null as string | null,
  };

  function repositoryWith(workOrder: unknown) {
    return { findById: vi.fn().mockResolvedValue(workOrder) };
  }

  it.each(["SUPER_ADMIN", "Super Admin"])(
    "role %s tanpa flag isSuperAdmin tetap lolos lingkup site",
    async (role) => {
      const workOrder = await validateWorkOrderAccess({
        repository: repositoryWith(workOrderSiteLain) as never,
        workOrderId: "wo-1",
        userContext: { id: "sa-1", role, permissions: SITE_ONLY },
      });

      expect(workOrder).toEqual(workOrderSiteLain);
    },
  );

  it("role biasa ber-site_only tetap ditolak", async () => {
    await expect(
      validateWorkOrderAccess({
        repository: repositoryWith(workOrderSiteLain) as never,
        workOrderId: "wo-1",
        userContext: {
          id: "admin-1",
          role: "Admin",
          permissions: SITE_ONLY,
          siteId: SITE_UTAMA,
        },
      }),
    ).rejects.toThrow("Akses ditolak: Site berbeda");
  });
});

describe("pembuatan WO oleh karyawan multi-site", () => {
  const userContext = {
    id: "admin-1",
    permissions: SITE_ONLY,
    siteId: SITE_UTAMA,
    siteIds: [SITE_UTAMA, SITE_KEDUA],
  };

  function inputWithSite(siteId?: string) {
    return {
      type: "REPAIR",
      title: "t",
      description: "d",
      siteId,
    } as unknown as CreateWorkOrderInput;
  }

  it("boleh membuat WO untuk site keduanya", () => {
    const normalizedInput = inputWithSite(SITE_KEDUA);

    enforceSiteRestriction({
      normalizedInput,
      userContext,
      isSuperAdmin: false,
    });

    expect(normalizedInput.siteId).toBe(SITE_KEDUA);
  });

  it("tanpa pilihan site, site utama dipakai", () => {
    const normalizedInput = inputWithSite();

    enforceSiteRestriction({
      normalizedInput,
      userContext,
      isSuperAdmin: false,
    });

    expect(normalizedInput.siteId).toBe(SITE_UTAMA);
  });

  it("site di luar miliknya ditolak", () => {
    expect(() =>
      enforceSiteRestriction({
        normalizedInput: inputWithSite(SITE_LAIN),
        userContext,
        isSuperAdmin: false,
      }),
    ).toThrow("Anda hanya dapat membuat work order untuk site Anda");
  });
});

describe("filter akses route admin memakai seluruh site profil", () => {
  const USER = { id: "admin-1", role: "Admin" };

  it("buildAccessFilters & getUserContext membawa semua site userSites", async () => {
    mocks.findUserProfile.mockResolvedValue({
      id: USER.id,
      role: "Admin",
      departmentId: null,
      siteId: SITE_UTAMA,
      siteIds: [SITE_UTAMA, SITE_KEDUA],
    });
    const service = new AdminWorkOrderRouteService();

    const access = await service.buildAccessFilters(USER, SITE_ONLY);
    const userContext = await service.getUserContext(USER, SITE_ONLY);

    expect(access).toMatchObject({
      emptyResponse: false,
      siteIds: [SITE_UTAMA, SITE_KEDUA],
      userSiteIds: [SITE_UTAMA, SITE_KEDUA],
    });
    expect(userContext?.siteIds).toEqual([SITE_UTAMA, SITE_KEDUA]);
  });

  it("buildAccessFilters gagal tertutup tanpa site", async () => {
    mocks.findUserProfile.mockResolvedValue({
      id: USER.id,
      role: "Admin",
      departmentId: null,
      siteId: null,
      siteIds: [],
    });

    const access = await new AdminWorkOrderRouteService().buildAccessFilters(
      USER,
      SITE_ONLY,
    );

    expect(access).toMatchObject({ emptyResponse: true });
  });

  it("filter permintaan WO: lingkup menang, site query tetap dipersempit", () => {
    const filters = new AdminWorkOrderRouteService().buildRequestListFilters({
      access: { siteIds: [SITE_UTAMA, SITE_KEDUA] },
      searchParams: new URLSearchParams({ siteId: SITE_LAIN, search: "odp" }),
    });

    expect(filters).toEqual({
      search: "odp",
      siteId: SITE_LAIN,
      siteIds: [SITE_UTAMA, SITE_KEDUA],
    });
    expect(resolveSiteFilter(filters)).toEqual({ in: [] });
  });

  it("filter permintaan WO: departemen terbatas mengabaikan query", () => {
    const filters = new AdminWorkOrderRouteService().buildRequestListFilters({
      access: { departmentId: "dept-1" },
      searchParams: new URLSearchParams({ departmentId: "dept-lain" }),
    });

    expect(filters).toEqual({ departmentId: "dept-1" });
  });
});
