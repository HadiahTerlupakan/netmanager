import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/roles", () => ({
  checkSiteRestriction: vi.fn(() => ({
    isRestricted: false,
    primarySiteId: null,
    siteIds: [],
  })),
  canAccessSite: vi.fn(() => true),
}));

import { PESAN_KEPALA_SALES_DIRI_SENDIRI } from "@/modules/users/validation";
import {
  buildBaseUpdateData,
  validateKepalaSalesTenant,
} from "@/modules/users/services/AdminUserRouteService.helpers";
import { AdminUserRouteUpdateService } from "@/modules/users/services/admin-user-route.update";
import type { AdminSession } from "@/modules/users/services/AdminUserRouteService.types";
import type { UserEntity } from "@/modules/users/domain/entities/UserEntity";

const SESI_ADMIN = {
  user: { id: "admin-1", tenantId: "t-1", permissions: ["users:update"] },
} as AdminSession;

const USER_TARGET = { id: "u-1", tenantId: "t-1" } as UserEntity;

describe("AdminUserRouteUpdateService.validateUpdate — kepala sales", () => {
  const layanan = new AdminUserRouteUpdateService();

  it("menolak 400 bila kepala sales = user yang diubah", () => {
    expect(
      layanan.validateUpdate(SESI_ADMIN, "u-1", USER_TARGET, {
        kepalaSalesId: "u-1",
      }),
    ).toEqual({
      ok: false,
      error: { code: 400, message: PESAN_KEPALA_SALES_DIRI_SENDIRI },
    });
  });

  it("meloloskan kepala sales lain", () => {
    expect(
      layanan.validateUpdate(SESI_ADMIN, "u-1", USER_TARGET, {
        kepalaSalesId: "k-1",
      }).ok,
    ).toBe(true);
  });
});

describe("validateKepalaSalesTenant", () => {
  const findUser = vi.fn(async (id: string) =>
    id === "k-1"
      ? { tenantId: "t-1" }
      : id === "k-lain"
        ? { tenantId: "t-2" }
        : null,
  );

  it("meloloskan lepas tim dan tanpa perubahan tanpa membaca repository", async () => {
    findUser.mockClear();
    for (const kepalaSalesId of [null, undefined] as Array<null | undefined>) {
      expect(
        (
          await validateKepalaSalesTenant({
            kepalaSalesId,
            tenantId: "t-1",
            findUser,
          })
        ).ok,
      ).toBe(true);
    }
    expect(findUser).not.toHaveBeenCalled();
  });

  it("meloloskan kepala sales satu tenant", async () => {
    expect(
      (
        await validateKepalaSalesTenant({
          kepalaSalesId: "k-1",
          tenantId: "t-1",
          findUser,
        })
      ).ok,
    ).toBe(true);
  });

  it("menolak kepala sales tenant lain atau yang tidak ada", async () => {
    for (const kepalaSalesId of ["k-lain", "hilang"]) {
      expect(
        await validateKepalaSalesTenant({
          kepalaSalesId,
          tenantId: "t-1",
          findUser,
        }),
      ).toMatchObject({ ok: false, error: { code: 400 } });
    }
  });
});

describe("buildBaseUpdateData — kepalaSalesId", () => {
  it("menulis null untuk melepas tim, dan tidak menyentuh bila tidak dikirim", () => {
    expect(
      buildBaseUpdateData({ kepalaSalesId: null }).kepalaSalesId,
    ).toBeNull();
    expect(buildBaseUpdateData({ kepalaSalesId: "k-1" }).kepalaSalesId).toBe(
      "k-1",
    );
    expect("kepalaSalesId" in buildBaseUpdateData({ name: "A" })).toBe(false);
  });
});
