import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handlerOptions: [] as Array<Record<string, unknown>>,
  listStatusHistory: vi.fn(),
  deleteReseller: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createHandler: vi.fn((options, handler) => {
      mocks.handlerOptions.push(options);
      return handler;
    }),
  };
});

vi.mock("@/modules/reseller", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getResellerStatusHistoryService: () => ({
      listStatusHistory: mocks.listStatusHistory,
    }),
    getResellerService: () => ({ deleteReseller: mocks.deleteReseller }),
  };
});

import { DELETE as deleteReseller } from "@/app/api/admin/resellers/[id]/route";
import { GET as getStatusHistory } from "@/app/api/admin/resellers/[id]/status-history/route";

type RouteBody = (req: NextRequest, ctx: unknown) => Promise<Response>;
const call = (route: unknown, ctx: unknown) =>
  (route as RouteBody)(new NextRequest("http://localhost/api"), ctx);
const SESSION = { user: { id: "admin-1", tenantId: "tenant-1" } };
const HISTORY_ITEM = {
  id: "h1",
  fromStatus: "ACTIVE",
  toStatus: "SUSPENDED",
  reason: "Tunggakan",
  changedById: "admin-1",
  changedAt: "2026-11-03T02:00:00.000Z",
};

describe("GET /api/admin/resellers/[id]/status-history", () => {
  beforeEach(() => vi.clearAllMocks());

  it("butuh reseller:read dan fitur reseller", () => {
    expect(mocks.handlerOptions).toContainEqual(
      expect.objectContaining({
        auth: true,
        permissions: ["reseller:read"],
        feature: "reseller",
      }),
    );
  });

  it("mengembalikan riwayat ter-paginasi dalam scope tenant sesi", async () => {
    mocks.listStatusHistory.mockResolvedValueOnce({
      items: [HISTORY_ITEM],
      total: 11,
    });

    const response = await call(getStatusHistory, {
      session: SESSION,
      params: { id: "r1" },
      query: { page: "2", limit: "10" },
    });

    expect(response.status).toBe(200);
    expect(mocks.listStatusHistory).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      resellerId: "r1",
      page: 2,
      limit: 10,
    });
    const body = await response.json();
    expect(body.data).toEqual([HISTORY_ITEM]);
    expect(body.meta ?? body.pagination).toMatchObject({
      page: 2,
      limit: 10,
      total: 11,
    });
  });

  it("memakai halaman default bila query kosong", async () => {
    mocks.listStatusHistory.mockResolvedValueOnce({ items: [], total: 0 });

    await call(getStatusHistory, {
      session: SESSION,
      params: { id: "r1" },
      query: { page: "", limit: "" },
    });

    expect(mocks.listStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it("404 bila reseller tidak ada di tenant", async () => {
    mocks.listStatusHistory.mockResolvedValueOnce(null);

    const response = await call(getStatusHistory, {
      session: SESSION,
      params: { id: "x" },
      query: {},
    });

    expect(response.status).toBe(404);
  });

  it("menolak limit di atas batas", async () => {
    await expect(
      call(getStatusHistory, {
        session: SESSION,
        params: { id: "r1" },
        query: { limit: "500" },
      }),
    ).rejects.toThrow();
    expect(mocks.listStatusHistory).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/resellers/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("meneruskan id admin sebagai pelaku perubahan status", async () => {
    await call(deleteReseller, { session: SESSION, params: { id: "r1" } });

    expect(mocks.deleteReseller).toHaveBeenCalledWith(
      "tenant-1",
      "r1",
      "admin-1",
    );
  });
});
