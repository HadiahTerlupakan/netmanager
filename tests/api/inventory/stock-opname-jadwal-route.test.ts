import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHasPermission = vi.hoisted(() => vi.fn());
const mockIsSuperAdmin = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => ({
  getJadwalSite: vi.fn(),
  simpanAturanSite: vi.fn(),
  simpanJadwalKhususSite: vi.fn(),
  getKepatuhan: vi.fn(),
  getSiteIdsPengguna: vi.fn(),
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
    async (req: NextRequest, extra?: { params?: Record<string, string> }) => {
      const body = req.method === "GET" ? undefined : await req.json();
      return handler(req, {
        params: extra?.params ?? {},
        session: { user: { id: "u-1", tenantId: "t-1", role: "Staff" } },
        validated: options.schema ? options.schema.parse(body) : body,
      });
    },
  apiSuccess: (data: unknown) => NextResponse.json({ success: true, data }),
  ApiErrors: {
    forbidden: (m: string) => NextResponse.json({ error: m }, { status: 403 }),
    badRequest: (m: string) => NextResponse.json({ error: m }, { status: 400 }),
    notFound: (m: string) => NextResponse.json({ error: m }, { status: 404 }),
    internalError: (m: string) => NextResponse.json({ error: m }, { status: 500 }),
  },
}));

import { GET as getKepatuhan } from "@/app/api/inventory/opname/kepatuhan/route";
import { PUT as putAturanSite } from "@/app/api/admin/sites/[id]/jadwal-so/route";
import { PUT as putJadwalKhusus } from "@/app/api/admin/sites/[id]/jadwal-so/[periode]/route";

describe("API jadwal SO per site & laporan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSuperAdmin.mockReturnValue(false);
    service.getKepatuhan.mockResolvedValue({ site: [] });
  });

  it("laporan: pengguna site_only dibatasi ke site-nya; tanpa opname:read ditolak", async () => {
    mockHasPermission.mockImplementation(async (izin: string) => ["opname:read", "opname:site_only"].includes(izin));
    service.getSiteIdsPengguna.mockResolvedValue(["s1"]);
    const res = await getKepatuhan(new NextRequest("http://x/api/inventory/opname/kepatuhan?periode=2026-09"), {} as never);
    expect(res.status).toBe(200);
    expect(service.getSiteIdsPengguna).toHaveBeenCalledWith("t-1", "u-1");
    expect(service.getKepatuhan).toHaveBeenCalledWith("t-1", "2026-09", ["s1"]);

    mockHasPermission.mockResolvedValue(false);
    expect((await getKepatuhan(new NextRequest("http://x/k"), {} as never)).status).toBe(403);
  });

  it("jadwal site hanya bisa diubah pemegang site:update", async () => {
    const kirim = () =>
      putAturanSite(
        new NextRequest("http://x/api/admin/sites/s1/jadwal-so", {
          method: "PUT",
          body: JSON.stringify({ isAktif: true, tanggalMulai: 25, tanggalSelesai: 30 }),
        }),
        { params: { id: "s1" } } as never,
      );
    mockHasPermission.mockImplementation(async (izin: string) => izin === "site:read");
    expect((await kirim()).status).toBe(403);
    expect(service.simpanAturanSite).not.toHaveBeenCalled();

    mockHasPermission.mockResolvedValue(true);
    expect((await kirim()).status).toBe(200);
    expect(service.simpanAturanSite).toHaveBeenCalledWith("t-1", "s1", { isAktif: true, tanggalMulai: 25, tanggalSelesai: 30 });
  });

  it("jadwal khusus: site tidak ditemukan → 404 dari service diteruskan", async () => {
    mockHasPermission.mockResolvedValue(true);
    const { createRouteServiceError } = await import("@/lib/api/route-service-error");
    service.simpanJadwalKhususSite.mockRejectedValue(createRouteServiceError("Site tidak ditemukan", 404));

    const res = await putJadwalKhusus(
      new NextRequest("http://x/api/admin/sites/sx/jadwal-so/2026-10", {
        method: "PUT",
        body: JSON.stringify({ mulai: "2026-10-01", selesai: "2026-10-05" }),
      }),
      { params: { id: "sx", periode: "2026-10" } } as never,
    );

    expect(res.status).toBe(404);
    expect(service.simpanJadwalKhususSite).toHaveBeenCalledWith(
      "t-1", "sx", "2026-10", { mulai: "2026-10-01", selesai: "2026-10-05" }, "u-1",
    );
  });
});
