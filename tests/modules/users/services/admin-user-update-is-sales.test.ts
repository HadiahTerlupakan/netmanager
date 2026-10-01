import { beforeEach, describe, expect, it, vi } from "vitest";

const findRolePersona = vi.hoisted(() => vi.fn());

vi.mock("@/modules/users/repositories/UserRepository", () => ({
  UserRepository: class {
    findRolePersona = findRolePersona;
    findById = vi.fn();
  },
}));

vi.mock("@/modules/users/services/role-assignment-guard", () => ({
  assertCanAssignRoleId: vi.fn(),
}));

vi.mock("@/modules/users/services/AdminUserRouteService.helpers", async (importOriginal) => {
  const asli =
    await importOriginal<typeof import("@/modules/users/services/AdminUserRouteService.helpers")>();
  const lolos = vi.fn(async () => ({ ok: true, data: null }));
  return {
    ...asli,
    applyTenantChange: lolos,
    applyEmailChange: lolos,
    validateKepalaSalesTenant: lolos,
  };
});

import { AdminUserRouteUpdateService } from "@/modules/users/services/admin-user-route.update";
import type { AdminSession } from "@/modules/users/services/AdminUserRouteService.types";

const session = {
  user: { id: "admin-1", isSuperAdmin: true, tenantId: "t-1", permissions: ["*"] },
} as unknown as AdminSession;
const currentUser = { id: "u-1", email: "u@x.id", tenantId: "t-1", roleId: "role-lama" } as never;

describe("AdminUserRouteUpdateService.buildUpdateData — isSales turunan persona role", () => {
  beforeEach(() => findRolePersona.mockReset());

  it("ganti ke role berpersona SALES → isSales true walau payload mengirim false", async () => {
    findRolePersona.mockResolvedValue("SALES");

    const result = await new AdminUserRouteUpdateService().buildUpdateData(
      session,
      "u-1",
      currentUser,
      { roleId: "role-sales", isSales: false } as never,
    );

    expect(result).toMatchObject({ ok: true, data: { roleId: "role-sales", isSales: true } });
    expect(findRolePersona).toHaveBeenCalledWith("role-sales");
  });

  it("ganti ke role non-SALES → isSales false walau payload mengirim true", async () => {
    findRolePersona.mockResolvedValue("TEKNISI");

    const result = await new AdminUserRouteUpdateService().buildUpdateData(
      session,
      "u-1",
      currentUser,
      { roleId: "role-teknisi", isSales: true } as never,
    );

    expect(result).toMatchObject({ ok: true, data: { isSales: false } });
  });

  it("tanpa roleId di payload, isSales dari payload diabaikan dan tidak disentuh", async () => {
    const result = await new AdminUserRouteUpdateService().buildUpdateData(
      session,
      "u-1",
      currentUser,
      { name: "Budi", isSales: true } as never,
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).not.toHaveProperty("isSales");
    expect(findRolePersona).not.toHaveBeenCalled();
  });
});
