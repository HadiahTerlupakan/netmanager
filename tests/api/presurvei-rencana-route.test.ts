import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jenisLingkupRencana } from "@/app/api/presurvei/akses-presurvei";

/**
 * Route rencana menerima permission web ATAU mobile. Lolos gerbang belum
 * berarti boleh melihat rencana orang lain: lingkupnya diturunkan dari jenis
 * permission — sales (mobile) sendiri, kepala sales timnya, admin semua.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  lingkup: vi.fn(),
  daftar: vi.fn(),
  buat: vi.fn(),
  konteksWaktu: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockFns.getServerSession }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  authConfig: {},
  getUserPermissions: mockFns.getUserPermissions,
}));
vi.mock("@/lib/api/idempotency-route-helpers", () => ({
  executeMobileWithIdempotency: async (opsi: { handler: () => Promise<unknown>; status: number }) => {
    const { apiSuccess } = await import("@/lib/api");
    return apiSuccess(await opsi.handler(), { status: opsi.status });
  },
}));
vi.mock("@/modules/presurvei", async () => {
  const actual = await vi.importActual<typeof import("@/modules/presurvei")>("@/modules/presurvei");
  return {
    ...actual,
    RencanaService: class {
      lingkup = mockFns.lingkup;
      daftar = mockFns.daftar;
      buat = mockFns.buat;
      konteksWaktu = mockFns.konteksWaktu;
    },
  };
});

import { GET, POST } from "@/app/api/presurvei/rencana/route";

const WAKTU = { hariIni: "2026-09-26", zonaWaktu: "Asia/Jakarta" };

const sesi = (permissions: string[]) => {
  mockFns.getServerSession.mockResolvedValue({
    user: { id: "user-1", email: "u@contoh.id", tenantId: "tenant-1", permissions },
  });
  mockFns.getUserPermissions.mockResolvedValue(permissions);
};

describe("jenisLingkupRencana", () => {
  it.each([
    [["m_presurvei:read"], "SENDIRI"],
    [["presurvei_rencana:read", "presurvei_rencana:create"], "TIM"],
    [["presurvei_rencana:read", "presurvei_rencana:view_all"], "SEMUA"],
    [["*"], "SEMUA"],
    // Permission presurvei web lain TIDAK membuka rencana orang lain.
    [["presurvei:read", "m_presurvei:read"], "SENDIRI"],
  ])("%j → %s", (izin, harapan) => {
    expect(jenisLingkupRencana(izin)).toBe(harapan);
  });
});

describe("/api/presurvei/rencana", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.lingkup.mockImplementation(async (pengguna, jenis) => ({ jenis, penggunaId: pengguna.id }));
    mockFns.daftar.mockResolvedValue({ items: [], total: 0, waktu: WAKTU });
    mockFns.konteksWaktu.mockResolvedValue(WAKTU);
  });

  it("GET sales mobile: lingkup SENDIRI, tenant dari sesi", async () => {
    sesi(["m_presurvei:read"]);

    const res = await GET(new NextRequest("http://x/api/presurvei/rencana?status=TERLEWAT"), { params: Promise.resolve({}) } as never);

    expect(res.status).toBe(200);
    expect(mockFns.lingkup).toHaveBeenCalledWith({ id: "user-1", tenantId: "tenant-1" }, "SENDIRI");
    expect(mockFns.daftar).toHaveBeenCalledWith(
      expect.objectContaining({ status: "TERLEWAT", page: 1, limit: 20 }),
      { jenis: "SENDIRI", penggunaId: "user-1" },
      "tenant-1",
    );
  });

  it("GET status tidak dikenal ditolak 400", async () => {
    sesi(["m_presurvei:read"]);

    const res = await GET(new NextRequest("http://x/api/presurvei/rencana?status=NGAWUR"), { params: Promise.resolve({}) } as never);

    expect(res.status).toBe(400);
    expect(mockFns.daftar).not.toHaveBeenCalled();
  });

  it("POST kepala sales: lingkup TIM, masukan tervalidasi diteruskan", async () => {
    sesi(["presurvei_rencana:create"]);
    mockFns.buat.mockResolvedValue({
      id: "r-1", salesId: "sales-a", status: "DIRENCANAKAN", tanggal: "2026-09-27",
      dilaporkanAt: null, dibatalkanAt: null, createdAt: new Date(),
    });

    const res = await POST(
      new NextRequest("http://x/api/presurvei/rencana", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ salesId: "sales-a", tanggal: "2026-09-27", tujuan: "Kunjungi Pak Budi" }),
      }),
      { params: Promise.resolve({}) } as never,
    );

    expect(res.status).toBe(201);
    expect(mockFns.buat).toHaveBeenCalledWith(
      expect.objectContaining({ salesId: "sales-a", tanggal: "2026-09-27", jenis: "KUNJUNGAN" }),
      { id: "user-1", tenantId: "tenant-1" },
      { jenis: "TIM", penggunaId: "user-1" },
    );
  });

  it("POST tanggal tidak berformat ditolak sebelum menyentuh service", async () => {
    sesi(["m_presurvei:create"]);

    const res = await POST(
      new NextRequest("http://x/api/presurvei/rencana", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tanggal: "27/09/2026", tujuan: "x" }),
      }),
      { params: Promise.resolve({}) } as never,
    );

    expect(res.status).toBe(400);
    expect(mockFns.buat).not.toHaveBeenCalled();
  });
});
