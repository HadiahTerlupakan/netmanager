import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
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
  rincian: vi.fn(),
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
    KegiatanService: class {
      daftar = mockFns.daftar;
      catat = mockFns.catat;
      rincian = mockFns.rincian;
      ubah = mockFns.ubah;
    },
  };
});

import { GET, POST } from "@/app/api/presurvei/kegiatan/route";
import {
  GET as GET_DETAIL,
  PATCH,
} from "@/app/api/presurvei/kegiatan/[id]/route";

const ID_SESI = "sales-a";
const ID_ORANG_LAIN = "sales-b";
const ID_KEGIATAN = "kegiatan-1";

const kegiatanTersimpan: KegiatanEntity = {
  id: ID_KEGIATAN,
  jenis: "TELEPON",
  userId: ID_SESI,
  namaSales: null,
  peranPelaku: null,
  departemenPelaku: null,
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

describe("GET /api/presurvei/kegiatan — filter peran dan departemen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.daftar.mockResolvedValue({ items: [], total: 0 });
  });

  it("meneruskan peran dan departemenId dari pemegang permission web", async () => {
    beriPermission(["presurvei:read"]);

    await mintaDaftar("peran=NON_SALES&departemenId=dept-teknik");

    expect(mockFns.daftar).toHaveBeenCalledWith(
      expect.objectContaining({
        peran: "NON_SALES",
        departemenId: "dept-teknik",
      }),
    );
    expect(mockFns.daftar.mock.calls[0][0].userId).toBeUndefined();
  });

  it("pemanggil mobile tetap terikat ke id sesinya walau mengirim peran", async () => {
    // Filter peran hanya mempersempit. Ia tidak boleh menjadi jalan keluar
    // dari pengikatan `userId` — dengan atau tanpa `userId` di query.
    beriPermission(["m_presurvei:read"]);

    await mintaDaftar("peran=NON_SALES");
    await mintaDaftar(
      `peran=SALES&departemenId=dept-teknik&userId=${ID_ORANG_LAIN}`,
    );

    expect(mockFns.daftar.mock.calls.map(([filter]) => filter.userId)).toEqual([
      ID_SESI,
      ID_SESI,
    ]);
    expect(mockFns.daftar.mock.calls[1][0]).toMatchObject({
      peran: "SALES",
      departemenId: "dept-teknik",
    });
  });

  it("menolak peran asing dengan 400 tanpa menyentuh service", async () => {
    beriPermission(["presurvei:read"]);

    const respons = await mintaDaftar("peran=false");

    expect(respons.status).toBe(400);
    expect(mockFns.daftar).not.toHaveBeenCalled();
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
    mockFns.rincian.mockResolvedValue({
      kegiatan: kegiatanTersimpan,
      riwayat: [],
    });
  });

  it("mengikat pemanggil mobile ke id sesinya", async () => {
    // Penjaga F (arah mobile) — pola identik dengan Penjaga C.
    beriPermission(["m_presurvei:read"]);

    await mintaDetail();

    expect(mockFns.rincian).toHaveBeenCalledWith(ID_KEGIATAN, ID_SESI);
  });

  it("membiarkan pemegang permission web melihat kegiatan siapa pun", async () => {
    // Penjaga F (arah web) — sisi sebaliknya.
    beriPermission(["presurvei:read"]);

    await mintaDetail();

    expect(mockFns.rincian).toHaveBeenCalledWith(ID_KEGIATAN, undefined);
  });
});

describe("GET /api/presurvei/kegiatan/[id] — riwayat", () => {
  it("menyertakan riwayat perubahan di rincian", async () => {
    vi.clearAllMocks();
    beriPermission(["presurvei:read"]);
    mockFns.rincian.mockResolvedValue({
      kegiatan: kegiatanTersimpan,
      riwayat: [
        {
          id: "riwayat-1",
          kegiatanId: ID_KEGIATAN,
          tenantId: "tenant-1",
          diubahOlehId: "admin-3",
          namaPengubah: "Admin Tiga",
          diubahPada: new Date("2026-09-23T02:00:00.000Z"),
          perubahan: { catatan: { dari: null, ke: "Isi" } },
        },
      ],
    });

    const respons = await mintaDetail();
    const badan = await respons.json();

    expect(badan.data.riwayat).toEqual([
      {
        id: "riwayat-1",
        diubahOlehId: "admin-3",
        namaPengubah: "Admin Tiga",
        diubahPada: "2026-09-23T02:00:00.000Z",
        perubahan: { catatan: { dari: null, ke: "Isi" } },
      },
    ]);
  });
});

const mintaUbah = (body: Record<string, unknown>) =>
  PATCH(
    new NextRequest(`http://localhost/api/presurvei/kegiatan/${ID_KEGIATAN}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: ID_KEGIATAN }) } as never,
  );

describe("PATCH /api/presurvei/kegiatan/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.ubah.mockResolvedValue({
      kegiatan: { ...kegiatanTersimpan, catatan: "Baru" },
      riwayat: [],
    });
  });

  it("mengikat pemanggil mobile ke kegiatannya sendiri, pengubah dari sesi", async () => {
    beriPermission(["m_presurvei:read", "m_presurvei:update"]);

    const respons = await mintaUbah({ catatan: "Baru" });

    expect(respons.status).toBe(200);
    expect(mockFns.ubah).toHaveBeenCalledWith(
      ID_KEGIATAN,
      { catatan: "Baru" },
      { idPengubah: ID_SESI, pemilikWajib: ID_SESI },
    );
  });

  it("membiarkan pemegang permission web mengubah kegiatan siapa pun", async () => {
    beriPermission(["presurvei:read", "presurvei:update"]);

    await mintaUbah({ hasil: "PERLU_FOLLOWUP" });

    expect(mockFns.ubah).toHaveBeenCalledWith(
      ID_KEGIATAN,
      { hasil: "PERLU_FOLLOWUP" },
      { idPengubah: ID_SESI, pemilikWajib: undefined },
    );
  });

  it("menolak 403 pemanggil tanpa permission update", async () => {
    beriPermission(["presurvei:read", "m_presurvei:read"]);

    const respons = await mintaUbah({ catatan: "Baru" });

    expect(respons.status).toBe(403);
    expect(mockFns.ubah).not.toHaveBeenCalled();
  });

  it("menolak 400 medan terlarang, termasuk upaya memalsukan pengubah", async () => {
    beriPermission(["presurvei:read", "presurvei:update"]);

    const respons = await mintaUbah({
      catatan: "Baru",
      diubahOlehId: ID_ORANG_LAIN,
    });

    expect(respons.status).toBe(400);
    expect(mockFns.ubah).not.toHaveBeenCalled();
  });

  it("meneruskan 403 service untuk kegiatan milik sales lain", async () => {
    beriPermission(["m_presurvei:update"]);
    mockFns.ubah.mockRejectedValue(
      new AppError("Kegiatan ini milik sales lain", 403, "FORBIDDEN"),
    );

    const respons = await mintaUbah({ catatan: "Baru" });

    expect(respons.status).toBe(403);
  });

  it("meneruskan 404 service untuk kegiatan yang tidak ada", async () => {
    beriPermission(["m_presurvei:update"]);
    mockFns.ubah.mockRejectedValue(
      new AppError("Kegiatan tidak ditemukan", 404, "NOT_FOUND"),
    );

    const respons = await mintaUbah({ catatan: "Baru" });

    expect(respons.status).toBe(404);
  });

  it("memisahkan versi dari perubahan dan meneruskannya sebagai Date", async () => {
    beriPermission(["presurvei:read", "presurvei:update"]);

    await mintaUbah({ catatan: "Baru", versi: "2026-09-22T08:00:00.321Z" });

    expect(mockFns.ubah).toHaveBeenCalledWith(
      ID_KEGIATAN,
      { catatan: "Baru" },
      {
        idPengubah: ID_SESI,
        pemilikWajib: undefined,
        versiDilihat: new Date("2026-09-22T08:00:00.321Z"),
      },
    );
  });

  it("tanpa versi (mobile lama), service yang menentukan versinya", async () => {
    beriPermission(["m_presurvei:update"]);

    await mintaUbah({ catatan: "Baru" });

    const [, , konteks] = mockFns.ubah.mock.calls[0];
    expect(konteks.versiDilihat).toBeUndefined();
  });

  it("menolak 400 badan yang hanya berisi versi", async () => {
    beriPermission(["presurvei:read", "presurvei:update"]);

    const respons = await mintaUbah({ versi: "2026-09-22T08:00:00.321Z" });

    expect(respons.status).toBe(400);
    expect(mockFns.ubah).not.toHaveBeenCalled();
  });

  it("mengembalikan rincian beserta riwayat", async () => {
    beriPermission(["presurvei:read", "presurvei:update"]);

    const badan = await (await mintaUbah({ catatan: "Baru" })).json();

    expect(badan.data.catatan).toBe("Baru");
    expect(badan.data.riwayat).toEqual([]);
  });
});

/**
 * Idempotensi POST: mobile mengirim ulang kegiatan dari antrean offline
 * setelah POST pertama timeout padahal server sudah commit. Header
 * `Idempotency-Key` yang sama wajib menghasilkan satu kegiatan saja.
 * Redis diganti peta di memori supaya `GenericIdempotencyService` asli ikut
 * teruji, bukan tiruannya.
 */
describe("POST /api/presurvei/kegiatan — idempotensi", () => {
  const KUNCI_IDEMPOTENSI = "req-kegiatan-1";
  const TENANT_SESI = "tenant-1";
  const TENANT_LAIN = "tenant-2";
  const penyimpanan = new Map<string, string>();

  const pasangRedisDiMemori = async (): Promise<void> => {
    const { redis } = await import("@/lib/redis");
    penyimpanan.clear();
    vi.mocked(redis.set).mockImplementation((async (
      kunci: string,
      nilai: string,
      ...opsi: unknown[]
    ) => {
      if (opsi.includes("NX") && penyimpanan.has(kunci)) return null;
      penyimpanan.set(kunci, nilai);
      return "OK";
    }) as never);
    vi.mocked(redis.get).mockImplementation(
      (async (kunci: string) => penyimpanan.get(kunci) ?? null) as never,
    );
    vi.mocked(redis.setex).mockImplementation((async (
      kunci: string,
      _ttl: number,
      nilai: string,
    ) => {
      penyimpanan.set(kunci, nilai);
      return "OK";
    }) as never);
    vi.mocked(redis.del).mockImplementation((async (kunci: string) =>
      penyimpanan.delete(kunci) ? 1 : 0) as never);
  };

  const masukSebagai = (userId: string, tenantId: string): void => {
    mockFns.getServerSession.mockResolvedValue({
      user: {
        id: userId,
        email: `${userId}@contoh.id`,
        tenantId,
        permissions: ["m_presurvei:create"],
      },
    });
  };

  const mintaCatatBerkunci = (body: Record<string, unknown>, kunci?: string) =>
    POST(
      new NextRequest("http://localhost/api/presurvei/kegiatan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(kunci ? { "Idempotency-Key": kunci } : {}),
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({}) } as never,
    );

  beforeEach(async () => {
    vi.clearAllMocks();
    await pasangRedisDiMemori();
    mockFns.catat.mockResolvedValue({
      kegiatan: kegiatanTersimpan,
      prospek: null,
    });
  });

  it("kunci sama dua kali: service sekali, respons kedua identik 201", async () => {
    masukSebagai(ID_SESI, TENANT_SESI);

    const pertama = await mintaCatatBerkunci(bodiDasar, KUNCI_IDEMPOTENSI);
    const kedua = await mintaCatatBerkunci(bodiDasar, KUNCI_IDEMPOTENSI);

    expect(mockFns.catat).toHaveBeenCalledTimes(1);
    expect(pertama.status).toBe(201);
    expect(kedua.status).toBe(201);
    expect(kedua.headers.get("X-Idempotent-Replay")).toBe("true");
    const badanPertama = await pertama.json();
    expect(badanPertama.data.kegiatan.id).toBe(ID_KEGIATAN);
    expect(await kedua.json()).toEqual(badanPertama);
  });

  it("tanpa kunci: service dipanggil setiap kali (web admin, klien lama)", async () => {
    masukSebagai(ID_SESI, TENANT_SESI);

    await mintaCatatBerkunci(bodiDasar);
    await mintaCatatBerkunci(bodiDasar);

    expect(mockFns.catat).toHaveBeenCalledTimes(2);
  });

  it("kunci sama dari user lain tidak memakai respons milik user pertama", async () => {
    masukSebagai(ID_SESI, TENANT_SESI);
    await mintaCatatBerkunci(bodiDasar, KUNCI_IDEMPOTENSI);

    masukSebagai(ID_ORANG_LAIN, TENANT_SESI);
    const respons = await mintaCatatBerkunci(bodiDasar, KUNCI_IDEMPOTENSI);

    expect(mockFns.catat).toHaveBeenCalledTimes(2);
    expect(mockFns.catat).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: ID_ORANG_LAIN }),
    );
    expect(respons.headers.get("X-Idempotent-Replay")).toBeNull();
  });

  it("kunci sama dari user yang sama di tenant lain tidak saling memakai", async () => {
    masukSebagai(ID_SESI, TENANT_SESI);
    await mintaCatatBerkunci(bodiDasar, KUNCI_IDEMPOTENSI);

    masukSebagai(ID_SESI, TENANT_LAIN);
    await mintaCatatBerkunci(bodiDasar, KUNCI_IDEMPOTENSI);

    expect(mockFns.catat).toHaveBeenCalledTimes(2);
  });

  it("kunci sama dengan waktuMulai berbeda ditolak 409 tanpa menulis", async () => {
    masukSebagai(ID_SESI, TENANT_SESI);
    const waktuLebihAwal = new Date(
      Date.parse(bodiDasar.waktuMulai) - 60_000,
    ).toISOString();

    await mintaCatatBerkunci(bodiDasar, KUNCI_IDEMPOTENSI);
    const respons = await mintaCatatBerkunci(
      { ...bodiDasar, waktuMulai: waktuLebihAwal },
      KUNCI_IDEMPOTENSI,
    );

    expect(respons.status).toBe(409);
    expect(mockFns.catat).toHaveBeenCalledTimes(1);
  });

  it("requestId di badan dibuang skema, bukan diteruskan ke service", async () => {
    masukSebagai(ID_SESI, TENANT_SESI);

    const respons = await mintaCatatBerkunci({
      ...bodiDasar,
      requestId: KUNCI_IDEMPOTENSI,
    });

    expect(respons.status).toBe(201);
    expect(mockFns.catat.mock.calls[0][0]).not.toHaveProperty("requestId");
  });
});
