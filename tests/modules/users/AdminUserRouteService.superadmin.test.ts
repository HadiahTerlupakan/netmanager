import { describe, expect, it, vi } from "vitest";
import { AdminUserRouteService } from "@/modules/users/services/AdminUserRouteService";

vi.mock("@/modules/roles", () => ({
  canAccessSite: () => true,
  checkSiteRestriction: () => ({
    isRestricted: false,
    siteIds: [] as string[],
  }),
}));

function createService() {
  const service = new AdminUserRouteService();
  (
    service as unknown as { userRepository: { findByIdWithRelations: unknown } }
  ).userRepository = {
    findByIdWithRelations: vi.fn().mockResolvedValue({
      id: "target-1",
      name: "Target",
      email: "t@example.com",
      siteId: "site-1",
      role: { name: "Teknisi", permission: [] },
      departments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  };
  return service;
}

const session = {
  user: { id: "admin-1", isSuperAdmin: true, tenantId: "t1" },
} as never;

describe("getAdminUserById — wildcard super admin", () => {
  // Regresi produksi: GET /api/admin/users/[id] membalas 403 untuk Super Admin.
  // Penyebabnya `permissions.includes("users:read")` — pengecekan mentah tanpa
  // cabang wildcard, padahal super admin memegang ["*"] sehingga includes()
  // bernilai false dan super admin justru ditolak.
  it("meloloskan super admin yang memegang wildcard", async () => {
    const result = await createService().getAdminUserById(session, "target-1", [
      "*",
    ]);

    expect(result.ok).toBe(true);
  });

  it("tetap meloloskan pemegang users:read eksplisit", async () => {
    const result = await createService().getAdminUserById(session, "target-1", [
      "users:read",
    ]);

    expect(result.ok).toBe(true);
  });

  it("tetap menolak yang tidak punya izin sama sekali", async () => {
    const result = await createService().getAdminUserById(session, "target-1", [
      "workorders:read",
    ]);

    expect(result.ok).toBe(false);
  });
});
