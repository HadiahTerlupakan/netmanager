import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Penilaian kinerja memakai lingkup rencana, dengan satu tambahan: pemegang
 * Laporan Pencapaian (sudah melihat capaian semua sales) menilai seluruh tim.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  lingkup: vi.fn(),
  nilai: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockFns.getServerSession }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  authConfig: {},
  getUserPermissions: mockFns.getUserPermissions,
}));
vi.mock("@/modules/presurvei", async () => {
  const actual = await vi.importActual<typeof import("@/modules/presurvei")>(
    "@/modules/presurvei",
  );
  return {
    ...actual,
    RencanaService: class {
      lingkup = mockFns.lingkup;
    },
    PenilaianService: class {
      nilai = mockFns.nilai;
    },
  };
});

import { GET } from "@/app/api/presurvei/penilaian/route";

const sesi = (permissions: string[]) => {
  mockFns.getServerSession.mockResolvedValue({
    user: {
      id: "user-1",
      email: "u@contoh.id",
      tenantId: "tenant-1",
      permissions,
    },
  });
  mockFns.getUserPermissions.mockResolvedValue(permissions);
};

const panggil = (query = "") =>
  GET(new NextRequest(`http://x/api/presurvei/penilaian${query}`), {
    params: Promise.resolve({}),
  } as never);

describe("GET /api/presurvei/penilaian", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.lingkup.mockImplementation(async (pengguna, jenis) => ({
      jenis,
      penggunaId: pengguna.id,
    }));
    mockFns.nilai.mockResolvedValue({ kepala: [], sales: [] });
  });

  it("kepala sales: lingkup TIM, periode dari query, tenant dari sesi", async () => {
    // Lingkup TIM menuntut wewenang menugaskan (`presurvei_rencana:create`);
    // izin baca saja tidak lagi menjadikan seseorang kepala sales.
    sesi(["presurvei_rencana:read", "presurvei_rencana:create"]);

    const res = await panggil("?tahun=2026&bulan=8");

    expect(res.status).toBe(200);
    expect(mockFns.nilai).toHaveBeenCalledWith(
      { tahun: 2026, bulan: 8 },
      { jenis: "TIM", penggunaId: "user-1" },
      "tenant-1",
    );
  });

  it("sales mobile: hanya dirinya", async () => {
    sesi(["m_presurvei:read"]);

    await panggil();

    expect(mockFns.nilai).toHaveBeenCalledWith(
      null,
      { jenis: "SENDIRI", penggunaId: "user-1" },
      "tenant-1",
    );
  });

  it("tanpa permission presurvei → 403", async () => {
    sesi(["users:read"]);

    const res = await panggil();

    expect(res.status).toBe(403);
    expect(mockFns.nilai).not.toHaveBeenCalled();
  });
});
