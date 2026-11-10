import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  ensureSiteAccess: vi.fn(),
  getApprovalStock: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
  };
});
vi.mock("@/lib/rbac", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/app/api/inventory/restock/_lib/restock-site-access", () => ({
  ensureRestockRequestSiteAccess: mocks.ensureSiteAccess,
}));
vi.mock("@/modules/inventory", async () => {
  const messages = await vi.importActual<
    typeof import("@/modules/inventory/services/restock-messages")
  >("@/modules/inventory/services/restock-messages");
  return {
    ...messages,
    getInventoryRouteService: () => ({
      getApprovalStock: mocks.getApprovalStock,
    }),
  };
});

import { GET } from "@/app/api/inventory/restock/requests/[id]/stok/route";

const handler = GET as unknown as (
  req: NextRequest,
  ctx: unknown,
) => Promise<Response>;
const ctx = {
  session: { user: { id: "user-1", tenantId: "tenant-1" } },
  params: { id: "pr-1" },
};
const call = () =>
  handler(
    new NextRequest(
      "http://localhost/api/inventory/restock/requests/pr-1/stok",
    ),
    ctx,
  );

describe("GET /api/inventory/restock/requests/[id]/stok", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
    mocks.hasPermission.mockResolvedValue(true);
    mocks.ensureSiteAccess.mockResolvedValue(null);
  });

  it("butuh izin restock:read", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    const response = await call();

    expect(response.status).toBe(403);
    expect(mocks.hasPermission).toHaveBeenCalledWith("restock:read");
    expect(mocks.getApprovalStock).not.toHaveBeenCalled();
  });

  it("pengajuan di site lain ditolak sebelum stok dibaca", async () => {
    mocks.ensureSiteAccess.mockResolvedValue(
      NextResponse.json({ error: "site lain" }, { status: 403 }),
    );

    const response = await call();

    expect(response.status).toBe(403);
    expect(mocks.getApprovalStock).not.toHaveBeenCalled();
  });

  it("pengajuan tidak ada: 404", async () => {
    mocks.getApprovalStock.mockResolvedValue(null);

    expect((await call()).status).toBe(404);
  });

  it("mengirim stok tanpa cache beserta waktu baca", async () => {
    mocks.getApprovalStock.mockResolvedValue({
      gudangId: "g-1",
      gudangName: "Gudang A",
      items: [],
    });

    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.getApprovalStock).toHaveBeenCalledWith({
      id: "pr-1",
      tenantId: "tenant-1",
    });
    expect(body.data).toMatchObject({ gudangId: "g-1", items: [] });
    expect(typeof body.data.fetchedAt).toBe("string");
  });

  it("gangguan server: 500 dengan pesan yang bisa ditindaklanjuti", async () => {
    mocks.getApprovalStock.mockRejectedValue(new Error("db down"));

    const response = await call();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).toContain(
      "Memuat stok gudang belum berhasil",
    );
  });
});
