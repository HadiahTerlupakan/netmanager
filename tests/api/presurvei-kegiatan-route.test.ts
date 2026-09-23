import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KegiatanEntity } from "@/modules/presurvei";

/**
 * `app/api/presurvei/kegiatan/route.ts` dan `kegiatan/[id]/route.ts`
 * memakai kelas pembatasan yang sama dengan route prospek: pemanggil mobile
 * dikunci ke datanya sendiri lewat pin server yang harus menang atas
 * masukan klien (GET daftar, POST) dan lewat `pemilikWajib` yang dioper ke
 * service (GET detail).
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  daftar: vi.fn(),
  catat: vi.fn(),
  detail: vi.fn(),
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
    KegiatanService: class {
      daftar = mockFns.daftar;
      catat = mockFns.catat;
      detail = mockFns.detail;
    },
  };
});

import { GET, POST } from "@/app/api/presurvei/kegiatan/route";
import { GET as GET_DETAIL } from "@/app/api/presurvei/kegiatan/[id]/route";

const ID_SESI = "sales-a";
const ID_ORANG_LAIN = "sales-b";
const ID_KEGIATAN = "kegiatan-1";

const kegiatanTersimpan: KegiatanEntity = {
  id: ID_KEGIATAN,
  jenis: "TELEPON",
  userId: ID_SESI,
  namaSales: null,
  prospekId: null,
  iklanId: null,
  waktuMulai: new Date("2026-09-22T08:00:00.000Z"),
  waktuSelesai: null,
  latitude: null,
  longitude: null,
  alamatDikunjungi: null,
  ditemuiNama: null,
  hasil: "TIDAK_MINAT",
  catatan: null,
  fotoUrls: [],
  odpTerdekat: null,
  estimasiKabelMeter: null,
  catatanTeknis: null,
  siteId: null,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-22T08:00:00.000Z"),
  updatedAt: new Date("2026-09-22T08:00:00.000Z"),
};

const beriPermission = (permissions: string[]): void => {
  // Lihat catatan yang sama di presurvei-prospek-route.test.ts: fallback
  // `getUserPermissions` tidak pernah tersentuh karena sesi tiruan selalu
  // membawa `permissions` sendiri.
  mockFns.getServerSession.mockResolvedValue({
    user: { id: ID_SESI, email: "sales-a@contoh.id", permissions },
  });
};

const mintaDaftar = (query: string) =>
  GET(new NextRequest(`http://localhost/api/presurvei/kegiatan?${query}`), {
    params: Promise.resolve({}),
  } as never);

// `waktuMulai` dihitung saat modul dimuat, bukan konstanta bertanggal tetap:
// skema menolak waktu lebih dari 15 menit di masa depan relatif terhadap jam
// server saat parse (lihat kegiatan.validator.ts), jadi tanggal tetap akan
// rapuh tergantung kapan suite ini dijalankan.
const bodiDasar = {
  jenis: "TELEPON",
  hasil: "TIDAK_MINAT",
  waktuMulai: new Date().toISOString(),
};

const mintaCatat = (body: Record<string, unknown>) =>
  POST(
    new NextRequest("http://localhost/api/presurvei/kegiatan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) } as never,
  );

const mintaDetail = () =>
  GET_DETAIL(
    new NextRequest(`http://localhost/api/presurvei/kegiatan/${ID_KEGIATAN}`),
    { params: Promise.resolve({ id: ID_KEGIATAN }) } as never,
  );

describe("GET /api/presurvei/kegiatan — pembatasan kepemilikan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.daftar.mockResolvedValue({ items: [], total: 0 });
  });

  it("mengikat pemanggil mobile ke id sesinya meski userId lain dikirim", async () => {
    // Penjaga D — pola identik dengan GET /api/presurvei/prospek yang sudah
    // dikunci; mutasi membalik urutan spread di kegiatan/route.ts harus
    // membuat ini merah.
    beriPermission(["m_presurvei:read"]);

    await mintaDaftar(`userId=${ID_ORANG_LAIN}`);

    expect(mockFns.daftar).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ID_SESI }),
    );
  });

  it("menghormati filter userId dari pemegang permission web", async () => {
    // Penjaga D, sisi sebaliknya — dua arah, bukan satu.
    beriPermission(["presurvei:read"]);

    await mintaDaftar(`userId=${ID_ORANG_LAIN}`);

    expect(mockFns.daftar).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ID_ORANG_LAIN }),
    );
  });
});

describe("POST /api/presurvei/kegiatan — userId dari sesi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.catat.mockResolvedValue({
      kegiatan: kegiatanTersimpan,
      prospek: null,
    });
  });

  it("mencatat kegiatan atas id sesi pemanggil", async () => {
    // Penjaga E. `catatKegiatanSchema` tidak mendefinisikan field `userId`
    // sama sekali, dan Zod men-strip key tak dikenal secara default
    // (diverifikasi langsung) — jadi tidak ada jalur mengirim `userId` palsu
    // lewat body JSON asli untuk route ini; `ctx.validated` tidak akan
    // pernah memilikinya apa pun urutan spread-nya. Test ini karenanya
    // positif: mengunci bahwa `userId` yang sampai ke service adalah id
    // sesi. Lihat laporan ronde ini untuk detail mutasi (termasuk yang
    // terbukti tidak bergigi) untuk penjaga ini.
    beriPermission(["m_presurvei:create"]);

    await mintaCatat(bodiDasar);

    expect(mockFns.catat).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ID_SESI }),
    );
  });
});

describe("GET /api/presurvei/kegiatan/[id] — pemilikWajib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.detail.mockResolvedValue(kegiatanTersimpan);
  });

  it("mengikat pemanggil mobile ke id sesinya", async () => {
    // Penjaga F (arah mobile) — pola identik dengan Penjaga C.
    beriPermission(["m_presurvei:read"]);

    await mintaDetail();

    expect(mockFns.detail).toHaveBeenCalledWith(ID_KEGIATAN, ID_SESI);
  });

  it("membiarkan pemegang permission web melihat kegiatan siapa pun", async () => {
    // Penjaga F (arah web) — sisi sebaliknya.
    beriPermission(["presurvei:read"]);

    await mintaDetail();

    expect(mockFns.detail).toHaveBeenCalledWith(ID_KEGIATAN, undefined);
  });
});
