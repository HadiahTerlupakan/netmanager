import { describe, expect, it, vi } from "vitest";

import {
  RabProjectSiteAccessService,
  buildRabSiteWhere,
  resolveRabCreateSiteId,
  resolveRabSiteScope,
} from "@/modules/proyek/services/RabProjectSiteAccessService";

const RESTRICTED = resolveRabSiteScope({ role: "ADMIN", siteIds: ["site-a"] }, [
  "expense:read",
  "expense:site_only",
]);

function serviceWith(project: { siteId: string | null } | null) {
  return new RabProjectSiteAccessService({
    findById: vi.fn().mockResolvedValue(project),
  } as never);
}

// Regresi: tidak satu pun endpoint Proyek RAB membaca expense:site_only.
describe("lingkup site Proyek RAB", () => {
  it("role tanpa expense:site_only (termasuk wildcard non-super) tidak dibatasi", () => {
    expect(resolveRabSiteScope({ role: "ADMIN" }, ["*"]).dibatasi).toBe(false);
    expect(
      resolveRabSiteScope({ role: "ADMIN" }, ["expense:read"]).dibatasi,
    ).toBe(false);
  });

  it("super admin tidak dibatasi walau punya expense:site_only", () => {
    expect(
      resolveRabSiteScope({ isSuperAdmin: true }, ["expense:site_only"])
        .dibatasi,
    ).toBe(false);
  });

  it("daftar: site yang diminta diiriskan dengan lingkup", () => {
    expect(buildRabSiteWhere(RESTRICTED)).toEqual({
      siteId: { in: ["site-a"] },
    });
    expect(buildRabSiteWhere(RESTRICTED, "site-a")).toEqual({
      siteId: "site-a",
    });
    expect(buildRabSiteWhere(RESTRICTED, "site-b")).toBeNull();
  });

  it("daftar: dibatasi tanpa site → kosong", () => {
    const scope = resolveRabSiteScope({ role: "ADMIN" }, ["expense:site_only"]);
    expect(buildRabSiteWhere(scope)).toBeNull();
  });

  it("proyek site lain dijawab 404", async () => {
    await expect(
      serviceWith({ siteId: "site-b" }).assertProjectAccessible(
        "rab-1",
        RESTRICTED,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      serviceWith({ siteId: null }).assertProjectAccessible(
        "rab-1",
        RESTRICTED,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("proyek di site sendiri lolos", async () => {
    await expect(
      serviceWith({ siteId: "site-a" }).assertProjectAccessible(
        "rab-1",
        RESTRICTED,
      ),
    ).resolves.toBeUndefined();
  });

  it("tidak boleh membuat/memindahkan proyek ke site lain atau tanpa site", () => {
    const service = serviceWith(null);
    expect(() =>
      service.assertTargetSiteAllowed(RESTRICTED, "site-b"),
    ).toThrow();
    expect(() => service.assertTargetSiteAllowed(RESTRICTED, null)).toThrow();
    expect(() =>
      service.assertTargetSiteAllowed(RESTRICTED, undefined),
    ).not.toThrow();
    expect(() =>
      service.assertTargetSiteAllowed(RESTRICTED, "site-a"),
    ).not.toThrow();
  });
});

describe("resolveRabCreateSiteId", () => {
  it("memakai site satu-satunya milik pengguna terbatas bila site dikosongkan", () => {
    expect(resolveRabCreateSiteId(RESTRICTED, null)).toBe("site-a");
    expect(resolveRabCreateSiteId(RESTRICTED, undefined)).toBe("site-a");
  });

  it("menghormati site yang dipilih", () => {
    expect(resolveRabCreateSiteId(RESTRICTED, "site-b")).toBe("site-b");
  });

  it("tetap kosong bila pengguna punya banyak site atau tidak dibatasi", () => {
    const multi = resolveRabSiteScope(
      { role: "ADMIN", siteIds: ["site-a", "site-b"] },
      ["expense:site_only"],
    );
    expect(resolveRabCreateSiteId(multi, null)).toBeNull();
    expect(resolveRabCreateSiteId({ dibatasi: false }, null)).toBeNull();
  });
});

// Regresi: rute setujui/tolak RAB, revisi, dan pengingat tidak membaca
// expense:site_only, sehingga penyetuju terbatas bisa bertindak atas RAB site lain.
describe("isProjectInUserScope", () => {
  const restrictedUser = { role: "ADMIN", siteIds: ["site-a"] };
  const restrictedPermissions = ["expense:site_only"];

  it("menolak RAB site lain untuk penyetuju terbatas", async () => {
    await expect(
      serviceWith({ siteId: "site-b" }).isProjectInUserScope(
        "rab-1",
        restrictedUser,
        restrictedPermissions,
      ),
    ).resolves.toBe(false);
  });

  it("mengizinkan RAB site sendiri", async () => {
    await expect(
      serviceWith({ siteId: "site-a" }).isProjectInUserScope(
        "rab-1",
        restrictedUser,
        restrictedPermissions,
      ),
    ).resolves.toBe(true);
  });

  it("tidak membaca proyek bila penyetuju tidak dibatasi", async () => {
    const findById = vi.fn();
    const service = new RabProjectSiteAccessService({ findById } as never);
    await expect(
      service.isProjectInUserScope("rab-1", restrictedUser, []),
    ).resolves.toBe(true);
    expect(findById).not.toHaveBeenCalled();
  });
});
