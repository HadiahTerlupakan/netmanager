import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProspekEntity } from "@/modules/presurvei";

/**
 * `app/api/presurvei/prospek/[id]/route.ts` menggabungkan dua kelas
 * pembatasan: PATCH hanya boleh menugaskan `pemilikId` untuk pemegang
 * permission web (Penjaga A/B), dan GET/PATCH sama-sama mengikat pemanggil
 * mobile ke prospek miliknya sendiri lewat `pemilikWajibUntuk` (Penjaga C).
 *
 * Penjaga A lahir dari `b50b3e0e fix(presurvei): cegah klien menugaskan
 * pemilik prospek` — perbaikan keamanan tersendiri di Fase 1 yang sampai
 * sebelum berkas ini belum tertutup test route sama sekali. Tanpanya, sales
 * bisa menyerahkan prospeknya ke orang lain lalu kehilangan aksesnya
 * sendiri, atau merebut prospek orang lain.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  detail: vi.fn(),
  ubah: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockFns.getServerSession,
}));

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
    ProspekService: class {
      detail = mockFns.detail;
      ubah = mockFns.ubah;
    },
  };
});

import { GET, PATCH } from "@/app/api/presurvei/prospek/[id]/route";

const ID_SESI = "sales-a";
const ID_ORANG_LAIN = "sales-b";
const ID_PROSPEK = "prospek-1";

const prospekTersimpan: ProspekEntity = {
  id: ID_PROSPEK,
  nama: "Budi",
  noTelp: "081234567890",
  email: null,
  alamat: "Jl. Merdeka 10",
  latitude: null,
  longitude: null,
  shareloc: null,
  sumber: "WALK_IN",
  iklanId: null,
  registrationId: null,
  referralNama: null,
  status: "BARU",
  pemilikId: ID_SESI,
  namaPemilik: null,
  paketDiminati: null,
  catatan: null,
  canvasingId: null,
  konversiAt: null,
  siteId: null,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-22T00:00:00.000Z"),
  updatedAt: new Date("2026-09-22T00:00:00.000Z"),
};

const beriPermission = (permissions: string[]): void => {
  // `getUserPermissions` hanya dipanggil createHandler saat session.user
  // tidak membawa `permissions` sendiri (lihat lib/api/handler.ts). Sesi
  // tiruan di sini selalu membawanya, jadi cabang fallback itu tidak pernah
  // tersentuh — mock-nya tetap didaftarkan (bentuk modul @/lib/auth harus
  // utuh) tapi sengaja tidak diberi `mockResolvedValue` agar tidak
  // menyesatkan pembaca.
  mockFns.getServerSession.mockResolvedValue({
    user: { id: ID_SESI, email: "sales-a@contoh.id", permissions },
  });
};

const mintaDetail = () =>
  GET(new NextRequest(`http://localhost/api/presurvei/prospek/${ID_PROSPEK}`), {
    params: Promise.resolve({ id: ID_PROSPEK }),
  } as never);

const mintaUbah = (body: Record<string, unknown>) =>
  PATCH(
    new NextRequest(`http://localhost/api/presurvei/prospek/${ID_PROSPEK}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: ID_PROSPEK }) } as never,
  );

describe("PATCH /api/presurvei/prospek/[id] — penugasan pemilik", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.ubah.mockResolvedValue(prospekTersimpan);
  });

  it("membuang pemilikId dari body pemanggil mobile", async () => {
    // Penjaga A — merah bila route berhenti membuang `pemilikId` untuk
    // pemanggil mobile.
    beriPermission(["m_presurvei:update"]);

    await mintaUbah({ pemilikId: ID_ORANG_LAIN, catatan: "Update lapangan" });

    expect(mockFns.ubah).toHaveBeenCalledTimes(1);
    const [, perubahan] = mockFns.ubah.mock.calls[0];
    expect(perubahan).not.toHaveProperty("pemilikId");
  });

  it("meneruskan pemilikId dari body pemegang permission web", async () => {
    // Penjaga B — sisi sebaliknya dari A. Kalau route membuang `pemilikId`
    // untuk SEMUA orang (bukan cuma mobile), test ini yang merah — dan itu
    // diam-diam melumpuhkan kemampuan admin menugaskan pemilik.
    beriPermission(["presurvei:read", "presurvei:update"]);

    await mintaUbah({ pemilikId: ID_ORANG_LAIN, catatan: "Update lapangan" });

    expect(mockFns.ubah).toHaveBeenCalledTimes(1);
    const [, perubahan] = mockFns.ubah.mock.calls[0];
    expect(perubahan).toMatchObject({ pemilikId: ID_ORANG_LAIN });
  });
});

describe("GET & PATCH /api/presurvei/prospek/[id] — pemilikWajib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.detail.mockResolvedValue(prospekTersimpan);
    mockFns.ubah.mockResolvedValue(prospekTersimpan);
  });

  it("GET mengikat pemanggil mobile ke id sesinya", async () => {
    // Penjaga C (separuh GET, arah mobile).
    beriPermission(["m_presurvei:read"]);

    await mintaDetail();

    expect(mockFns.detail).toHaveBeenCalledWith(ID_PROSPEK, ID_SESI);
  });

  it("GET membiarkan pemegang permission web melihat prospek siapa pun", async () => {
    // Penjaga C (separuh GET, arah web) — sisi sebaliknya dari test di atas.
    beriPermission(["presurvei:read"]);

    await mintaDetail();

    expect(mockFns.detail).toHaveBeenCalledWith(ID_PROSPEK, undefined);
  });

  it("PATCH mengikat pemanggil mobile ke id sesinya", async () => {
    // Penjaga C (separuh PATCH, arah mobile).
    beriPermission(["m_presurvei:update"]);

    await mintaUbah({ catatan: "Update lapangan" });

    expect(mockFns.ubah).toHaveBeenCalledWith(
      ID_PROSPEK,
      expect.objectContaining({ catatan: "Update lapangan" }),
      ID_SESI,
    );
  });

  it("PATCH membiarkan pemegang permission web mengubah prospek siapa pun", async () => {
    // Penjaga C (separuh PATCH, arah web) — sisi sebaliknya dari test di atas.
    beriPermission(["presurvei:read", "presurvei:update"]);

    await mintaUbah({ catatan: "Update lapangan" });

    expect(mockFns.ubah).toHaveBeenCalledWith(
      ID_PROSPEK,
      expect.objectContaining({ catatan: "Update lapangan" }),
      undefined,
    );
  });
});
