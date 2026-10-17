import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi
    .fn()
    .mockResolvedValue({ user: { id: "user-1", tenantId: "tenant-1" } }),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/modules/inventory", () => ({
  getJasaService: () => ({ list: mocks.list, create: mocks.create }),
}));

import { filterAdminMenuItems } from "@/components/layout/admin-sidebar/adminSidebarMenu";
import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";

function grant(...permissions: string[]) {
  mocks.hasPermission.mockImplementation(async (permission: string) =>
    permissions.includes(permission),
  );
}

function inventoryChildNames(permissions: string[]) {
  const inventory = filterAdminMenuItems({
    items: ADMIN_MENU_CONFIG,
    hasPermission: (permission) => permissions.includes(permission),
  }).find((item) => item.code === "INVENTORY");
  return (inventory?.children ?? []).map((child) => child.name);
}

describe("Pemisahan Master Jasa dari Master Barang", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
    mocks.list.mockResolvedValue({ items: [], total: 0 });
  });

  it("menampilkan menu Master Jasa terpisah bagi pemegang jasa:read", () => {
    expect(inventoryChildNames(["inventory:read", "jasa:read"])).toContain(
      "Master Jasa",
    );
  });

  it("menyembunyikan menu Master Jasa dari pemegang barang:read saja", () => {
    const names = inventoryChildNames(["inventory:read", "barang:read"]);
    expect(names).toContain("Master Barang");
    expect(names).not.toContain("Master Jasa");
  });

  it("API daftar jasa memakai izin jasa:read, bukan barang:read", async () => {
    const { GET } = await import("@/app/api/inventory/jasa/route");

    grant("barang:read");
    const denied = await GET(
      new NextRequest("http://localhost/api/inventory/jasa"),
    );
    grant("jasa:read");
    const allowed = await GET(
      new NextRequest("http://localhost/api/inventory/jasa"),
    );

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
  });

  it("API buat jasa memakai izin jasa:create", async () => {
    const { POST } = await import("@/app/api/inventory/jasa/route");
    grant("barang:create");

    const response = await POST(
      new NextRequest("http://localhost/api/inventory/jasa", {
        method: "POST",
        body: JSON.stringify({ nama: "Tanam Tiang", satuan: "job" }),
      }),
    );

    expect(response.status).toBe(403);
  });
});
