import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHasPermission = vi.fn();
const mockFindMany = vi.fn();
const mockResolveContent = vi.fn();

vi.mock("@/lib/api", () => ({
  createHandler:
    (_options: unknown, handler: (req: Request, ctx: unknown) => unknown) =>
    (req: Request, ctx: unknown) =>
      handler(req, ctx),
  apiSuccess: <T>(data: T) => data,
  ApiErrors: {
    forbidden: (message: string) => ({ error: message, status: 403 }),
    badRequest: (message: string) => ({ error: message, status: 400 }),
  },
}));
vi.mock("@/lib/rbac", () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/modules/database", () => ({
  prisma: {
    mikroTikRouter: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));
vi.mock("@/modules/network/isolir/isolir-content", () => ({
  resolveIsolirContent: (...args: unknown[]) => mockResolveContent(...args),
}));
vi.mock("@/modules/network", async () => {
  const service = await import("@/modules/network/isolir/IsolirPageService");
  const instance = service.createIsolirPageService(vi.fn());
  return { getIsolirPageService: () => instance };
});

import type { IsolirContent } from "@/modules/network/isolir/isolir-page.types";
import { renderIsolirPage } from "@/modules/network/isolir/isolir-render";
import { GET } from "@/app/api/admin/isolir-page/status/route";

const content: IsolirContent = {
  ispName: "Net Contoh",
  title: "Diisolir",
  message: "Bayar dulu",
  logoDataUri: null,
  payments: [],
  whatsapp: null,
  link: null,
  contactText: null,
  primaryColor: "#1d4ed8",
};
const session = (tenantId: string | null) =>
  ({ session: { user: { id: "u1", tenantId } } }) as never;
const request = () =>
  new NextRequest("http://localhost/api/admin/isolir-page/status");

describe("GET /api/admin/isolir-page/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
    mockResolveContent.mockResolvedValue(content);
  });

  it("hanya membaca router ROUTER_PAGE milik tenant sesi, tanpa kredensial", async () => {
    mockFindMany.mockResolvedValue([]);

    await GET(request(), session("t1"));

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const query = mockFindMany.mock.calls[0][0];
    expect(query.where).toEqual({ tenantId: "t1", isolirMode: "ROUTER_PAGE" });
    expect(Object.keys(query.select).sort()).toEqual([
      "id",
      "isolirPageError",
      "isolirPageHash",
      "isolirPageSyncedAt",
      "name",
    ]);
  });

  it("menandai router tersinkron bila hash-nya sama dengan halaman terkini", async () => {
    const { hash } = renderIsolirPage(content);
    const syncedAt = new Date("2026-10-25T01:00:00Z");
    mockFindMany.mockResolvedValue([
      {
        id: "r1",
        name: "Router A",
        isolirPageHash: hash,
        isolirPageSyncedAt: syncedAt,
        isolirPageError: null,
      },
      {
        id: "r2",
        name: "Router B",
        isolirPageHash: null,
        isolirPageSyncedAt: null,
        isolirPageError: "timeout",
      },
    ]);

    const result = await GET(request(), session("t1"));

    expect(result).toEqual([
      {
        id: "r1",
        name: "Router A",
        synced: true,
        isolirPageSyncedAt: syncedAt,
        isolirPageError: null,
      },
      {
        id: "r2",
        name: "Router B",
        synced: false,
        isolirPageSyncedAt: null,
        isolirPageError: "timeout",
      },
    ]);
    expect(mockResolveContent).toHaveBeenCalledWith("t1");
  });

  it("menolak tanpa isolir_page:read", async () => {
    mockHasPermission.mockResolvedValue(false);

    const result = await GET(request(), session("t1"));

    expect(mockHasPermission).toHaveBeenCalledWith("isolir_page:read");
    expect(result).toMatchObject({ status: 403 });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("super admin tanpa tenant mendapat 400 Pilih tenant", async () => {
    const result = await GET(request(), session(null));

    expect(result).toEqual({ error: "Pilih tenant", status: 400 });
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
