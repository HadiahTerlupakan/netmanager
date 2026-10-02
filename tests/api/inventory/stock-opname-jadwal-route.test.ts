import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHasPermission = vi.hoisted(() => vi.fn());
const mockIsSuperAdmin = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => ({
  getJadwal: vi.fn(),
  simpanAturan: vi.fn(),
  getKepatuhan: vi.fn(),
  siteIdsPengguna: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ hasPermission: mockHasPermission }));
vi.mock("@/lib/auth", () => ({ isSuperAdmin: mockIsSuperAdmin }));
vi.mock("@/modules/inventory", () => ({
  getStockOpnameJadwalService: () => service,
  periodeStockOpnameDari: () => "2026-10",
}));
vi.mock("@/lib/api", () => ({
  createHandler:
    (options: { schema?: { parse: (v: unknown) => unknown } }, handler: (req: NextRequest, ctx: unknown) => unknown) =>
    async (req: NextRequest) => {
      const body = req.method === "GET" ? undefined : await req.json();
      return handler(req, {
        params: {},
        session: { user: { id: "u-1", tenantId: "t-1", role: "Staff Gudang" } },
        validated: options.schema ? options.schema.parse(body) : body,
      });
    },
  apiSuccess: (data: unknown) => NextResponse.json({ success: true, data }),
  ApiErrors: {
    forbidden: (m: string) => NextResponse.json({ error: m }, { status: 403 }),
    badRequest: (m: string) => NextResponse.json({ error: m }, { status: 400 }),
    internalError: (m: string) => NextResponse.json({ error: m }, { status: 500 }),
  },
}));

import { GET as getKepatuhan } from "@/app/api/inventory/opname/kepatuhan/route";
import { PUT as putAturan } from "@/app/api/inventory/opname/jadwal/route";

describe("API jadwal & kepatuhan SO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdmin.mockReturnValue(false);
    service.getKepatuhan.mockResolvedValue({ site: [] });
  });

  it("kepatuhan: pengguna site_only dibatasi ke site-nya", async () => {
    mockHasPermission.mockImplementation(async (izin: string) => ["opname:read", "opname:site_only"].includes(izin));
    service.siteIdsPengguna.mockResolvedValue(["s1"]);

    const res = await getKepatuhan(new NextRequest("http://x/api/inventory/opname/kepatuhan?periode=2026-09"), {} as never);

    expect(res.status).toBe(200);
    expect(service.getKepatuhan).toHaveBeenCalledWith("t-1", "2026-09", ["s1"]);
  });

  it("kepatuhan: tanpa site_only melihat semua site; tanpa opname:read ditolak", async () => {
    mockHasPermission.mockImplementation(async (izin: string) => izin === "opname:read");
    await getKepatuhan(new NextRequest("http://x/api/inventory/opname/kepatuhan"), {} as never);
    expect(service.getKepatuhan).toHaveBeenCalledWith("t-1", "2026-10", null);

    mockHasPermission.mockResolvedValue(false);
    const res = await getKepatuhan(new NextRequest("http://x/api/inventory/opname/kepatuhan"), {} as never);
    expect(res.status).toBe(403);
  });

  it("aturan bawaan hanya bisa diubah pemegang opname:manage", async () => {
    mockHasPermission.mockImplementation(async (izin: string) => izin === "opname:read");
    const kirim = () =>
      putAturan(
        new NextRequest("http://x/api/inventory/opname/jadwal", {
          method: "PUT",
          body: JSON.stringify({ isAktif: true, tanggalMulai: 25, tanggalSelesai: 30 }),
        }),
        {} as never,
      );
    expect((await kirim()).status).toBe(403);
    expect(service.simpanAturan).not.toHaveBeenCalled();

    mockHasPermission.mockResolvedValue(true);
    expect((await kirim()).status).toBe(200);
    expect(service.simpanAturan).toHaveBeenCalledWith("t-1", { isAktif: true, tanggalMulai: 25, tanggalSelesai: 30 });
  });
});
