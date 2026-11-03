import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  prismaAuth: prismaMock,
}));

/**
 * `GET /api/sites` mengikuti aturan lingkup yang sama dengan data modulnya:
 * hanya `<resource>:site_only` (cocok persis) yang membatasi; kolom lama
 * `Role.isRestricted` tidak lagi dibaca.
 */

interface UserFixture {
  siteId?: string | null;
  userSites?: string[];
  roleName?: string;
  isSuperAdmin?: boolean;
  isRestricted?: boolean;
  permissions?: string[];
}

function mockUser(fixture: UserFixture) {
  prismaMock.user.findUnique.mockResolvedValue({
    id: "user-1",
    siteId: fixture.siteId ?? null,
    userSites: (fixture.userSites ?? []).map((siteId) => ({ siteId })),
    role: {
      name: fixture.roleName ?? "admin",
      isSuperAdmin: fixture.isSuperAdmin ?? false,
      isRestricted: fixture.isRestricted ?? true,
      permission: (fixture.permissions ?? []).map((name) => {
        const [resource, action] = name.split(":");
        return { resource, action };
      }),
    },
  } as never);
}

describe("SiteAccessRouteService lingkup site", () => {
  let SiteAccessRouteService: typeof import("@/modules/roles/services/SiteAccessRouteService").SiteAccessRouteService;

  beforeEach(async () => {
    vi.clearAllMocks();
    prismaMock.sites.findMany.mockResolvedValue([] as never);
    ({ SiteAccessRouteService } =
      await import("@/modules/roles/services/SiteAccessRouteService"));
  });

  async function whereFor(resource?: string) {
    await new SiteAccessRouteService().getAccessibleSites(
      { id: "user-1" },
      resource,
    );
    return prismaMock.sites.findMany.mock.calls[0][0].where;
  }

  it("tanpa resource: seluruh site tenant walau role.isRestricted=true", async () => {
    mockUser({
      siteId: "site-1",
      isRestricted: true,
      permissions: ["pelanggan:site_only"],
    });
    expect(await whereFor()).toEqual({});
  });

  it("resource tanpa site_only: seluruh site walau role.isRestricted=true", async () => {
    mockUser({
      siteId: "site-1",
      isRestricted: true,
      permissions: ["bandwidth:read"],
    });
    expect(await whereFor("bandwidth")).toEqual({});
  });

  it("resource dengan site_only: seluruh userSites pengguna", async () => {
    mockUser({
      siteId: "site-1",
      userSites: ["site-1", "site-2"],
      isRestricted: false,
      permissions: ["bandwidth:site_only"],
    });
    expect(await whereFor("bandwidth")).toEqual({
      id: { in: ["site-1", "site-2"] },
    });
  });

  it("resource dengan site_only tanpa userSites: jatuh ke siteId lama", async () => {
    mockUser({ siteId: "site-1", permissions: ["mitra:site_only"] });
    expect(await whereFor("mitra")).toEqual({ id: { in: ["site-1"] } });
  });

  it("resource dengan site_only tanpa site sama sekali: gagal tertutup", async () => {
    mockUser({ siteId: null, permissions: ["mitra:site_only"] });
    expect(await whereFor("mitra")).toEqual({ id: { in: [] } });
  });

  it("site_only resource lain tidak membatasi resource ini", async () => {
    mockUser({ siteId: "site-1", permissions: ["pelanggan:site_only"] });
    expect(await whereFor("bandwidth")).toEqual({});
  });

  it('cocok persis: wildcard "*" tidak dianggap site_only', async () => {
    mockUser({ siteId: "site-1", permissions: ["*:*"] });
    expect(await whereFor("bandwidth")).toEqual({});
  });

  it("super admin tidak dibatasi walau memegang site_only", async () => {
    mockUser({
      siteId: "site-1",
      roleName: "SUPER_ADMIN",
      isSuperAdmin: true,
      permissions: ["bandwidth:site_only"],
    });
    expect(await whereFor("bandwidth")).toEqual({});
  });

  it("super admin dikenali dari nama role kanonik", async () => {
    mockUser({
      siteId: "site-1",
      roleName: "SUPER_ADMIN",
      isSuperAdmin: false,
      permissions: ["bandwidth:site_only"],
    });
    expect(await whereFor("bandwidth")).toEqual({});
  });
});
