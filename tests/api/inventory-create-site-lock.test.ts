import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

/**
 * Regresi: pencatatan barang masuk/keluar/transfer dari web dulu tidak pernah
 * terkunci site. Route membangun sesi akses dari `ctx.session.user`, yang
 * tidak membawa permission (permission ada di `ctx.permissions`), sehingga
 * `validateGudangSiteAccess` tidak pernah melihat `*:site_only` dan selalu
 * menjawab "boleh".
 *
 * Test ini sengaja TIDAK memalsukan `buildInventoryAccessSession` maupun
 * `validateGudangSiteAccess` — persis dua fungsi yang dipalsukan test route
 * lama sehingga bug itu lolos. Hanya basis data dan service pencatatnya yang
 * dipalsukan.
 */

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
  };
});

vi.mock("@/lib/rbac", () => ({ hasPermission: vi.fn(async () => true) }));

import { POST as postMasuk } from "@/app/api/inventory/masuk/route";
import { POST as postKeluar } from "@/app/api/inventory/keluar/route";
import { POST as postTransfer } from "@/app/api/inventory/transfer/route";
import {
  inventoryKeluarRouteService,
  inventoryMasukRouteService,
  inventoryTransferRouteService,
} from "@/modules/inventory";

const STAF = { id: "staf-1", role: "STAFF", email: "staf@example.com" };
const GUDANG_SITE_LAIN = {
  id: "gudang-lain",
  tenantId: "tenant-1",
  sites: [{ id: "site-2" }],
};

function buildRequest(path: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

/** Konteks `createHandler`: user sesi TANPA permission, permission di `ctx`. */
function buildContext(permissions: string[]) {
  return { session: { user: STAF }, params: {}, permissions } as never;
}

describe("Pencatatan stok dari web terkunci site", () => {
  beforeEach(() => {
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      siteId: "site-1",
      role: "STAFF",
      userSites: [],
    } as never);
    vi.mocked(prismaMock.gudang.findUnique).mockResolvedValue(
      GUDANG_SITE_LAIN as never,
    );
  });

  it.each([
    ["barang masuk", "masuk:site_only"],
    ["barang masuk (via gudang:site_only)", "gudang:site_only"],
  ])("menolak %s ke gudang site lain", async (_label, izin) => {
    const createMasuk = vi.spyOn(inventoryMasukRouteService, "createMasuk");

    const response = await postMasuk(
      buildRequest("/api/inventory/masuk", {
        barangId: "barang-1",
        gudangId: "gudang-lain",
        jumlah: 1,
      }),
      buildContext(["masuk:create", izin]),
    );

    expect(response.status).toBe(403);
    expect(createMasuk).not.toHaveBeenCalled();
  });

  it("menolak barang keluar dari gudang site lain untuk role keluar:site_only", async () => {
    const createKeluar = vi.spyOn(inventoryKeluarRouteService, "createKeluar");

    const response = await postKeluar(
      buildRequest("/api/inventory/keluar", {
        barangId: "barang-1",
        gudangId: "gudang-lain",
        jumlah: 1,
      }),
      buildContext(["keluar:create", "keluar:site_only"]),
    );

    expect(response.status).toBe(403);
    expect(createKeluar).not.toHaveBeenCalled();
  });

  it("menolak transfer ke gudang tujuan site lain untuk role transfer:site_only", async () => {
    const createTransfer = vi.spyOn(
      inventoryTransferRouteService,
      "createTransfer",
    );
    vi.mocked(prismaMock.gudang.findUnique).mockImplementation((async (args: {
      where: { id: string };
    }) =>
      args.where.id === "gudang-sendiri"
        ? {
            id: "gudang-sendiri",
            tenantId: "tenant-1",
            sites: [{ id: "site-1" }],
          }
        : GUDANG_SITE_LAIN) as never);

    const response = await postTransfer(
      buildRequest("/api/inventory/transfer", {
        barangId: "barang-1",
        dariGudangId: "gudang-sendiri",
        keGudangId: "gudang-lain",
        jumlah: 1,
      }),
      buildContext(["transfer:create", "transfer:site_only"]),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(JSON.stringify(body)).toContain("Gudang tujuan");
    expect(createTransfer).not.toHaveBeenCalled();
  });

  it("role tanpa pembatasan site tetap boleh mencatat ke gudang mana pun", async () => {
    const createMasuk = vi
      .spyOn(inventoryMasukRouteService, "createMasuk")
      .mockResolvedValue({
        success: false,
        status: 400,
        error: "berhenti di service",
      });

    const response = await postMasuk(
      buildRequest("/api/inventory/masuk", {
        barangId: "barang-1",
        gudangId: "gudang-lain",
        jumlah: 1,
      }),
      buildContext(["masuk:create"]),
    );

    expect(response.status).toBe(400);
    expect(createMasuk).toHaveBeenCalled();
  });
});
