import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProspekEntity } from "@/modules/presurvei";

/**
 * Pembatasan kepemilikan di lapisan route.
 *
 * Permission presurvei bersifat ATAU — pemanggil bermodal permission mobile
 * saja lolos gerbang yang sama dengan admin web. Yang membedakan keduanya
 * adalah penimpaan filter di route ini. Tanpa test, refactor yang membalik
 * urutan spread mengembalikan celahnya tanpa suara.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  daftar: vi.fn(),
  buat: vi.fn(),
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
      daftar = mockFns.daftar;
      buat = mockFns.buat;
    },
  };
});

import { GET, POST } from "@/app/api/presurvei/prospek/route";

const ID_SESI = "sales-a";
const ID_ORANG_LAIN = "sales-b";

const prospekTersimpan: ProspekEntity = {
  id: "prospek-1",
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
  // tidak membawa `permissions` sendiri (lihat lib/api/handler.ts). Sesi tiruan
  // di sini selalu membawanya, jadi cabang fallback itu tidak pernah tersentuh
  // — mock-nya tetap didaftarkan (bentuk modul @/lib/auth harus utuh) tapi
  // sengaja tidak diberi `mockResolvedValue` agar tidak menyesatkan pembaca.
  mockFns.getServerSession.mockResolvedValue({
    user: { id: ID_SESI, email: "sales-a@contoh.id", permissions },
  });
};

const mintaDaftar = (query: string) =>
  GET(new NextRequest(`http://localhost/api/presurvei/prospek?${query}`), {
    params: Promise.resolve({}),
  } as never);

const mintaBuat = (body: Record<string, unknown>) =>
  POST(
    new NextRequest("http://localhost/api/presurvei/prospek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) } as never,
  );

describe("GET /api/presurvei/prospek — pembatasan kepemilikan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.daftar.mockResolvedValue({ items: [], total: 0 });
  });

  it("memaksa pemanggil bermodal permission mobile melihat miliknya sendiri", async () => {
    // Inilah test yang merah bila urutan spread di route dibalik.
    beriPermission(["m_presurvei:read"]);

    await mintaDaftar(`pemilikId=${ID_ORANG_LAIN}`);

    expect(mockFns.daftar).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: ID_SESI }),
    );
  });

  it("menghormati filter pemilik dari pemegang permission web", async () => {
    beriPermission(["presurvei:read"]);

    await mintaDaftar(`pemilikId=${ID_ORANG_LAIN}`);

    expect(mockFns.daftar).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: ID_ORANG_LAIN }),
    );
  });

  it("memperlakukan wildcard super admin seperti permission web", async () => {
    beriPermission(["*"]);

    await mintaDaftar(`pemilikId=${ID_ORANG_LAIN}`);

    expect(mockFns.daftar).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: ID_ORANG_LAIN }),
    );
  });

  it("tetap mengikat pemanggil mobile meski tidak mengirim filter pemilik", async () => {
    beriPermission(["m_presurvei:read"]);

    await mintaDaftar("page=1");

    expect(mockFns.daftar).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: ID_SESI }),
    );
  });
});

describe("POST /api/presurvei/prospek — penugasan pemilik", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.buat.mockResolvedValue(prospekTersimpan);
  });

  const bodiDasar = {
    nama: "Budi",
    noTelp: "081234567890",
    alamat: "Jl. Merdeka 10",
    sumber: "WALK_IN",
  };

  it("mengabaikan pemilik kiriman klien dari pemanggil mobile", async () => {
    beriPermission(["m_presurvei:create"]);

    await mintaBuat({ ...bodiDasar, pemilikId: ID_ORANG_LAIN });

    expect(mockFns.buat).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: ID_SESI }),
      expect.objectContaining({ abaikanDuplikat: undefined }),
    );
  });

  it("menghormati pemilik kiriman admin web", async () => {
    beriPermission(["presurvei:read", "presurvei:create"]);

    await mintaBuat({ ...bodiDasar, pemilikId: ID_ORANG_LAIN });

    expect(mockFns.buat).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: ID_ORANG_LAIN }),
      expect.objectContaining({ abaikanDuplikat: undefined }),
    );
  });

  it("meneruskan penanda abaikan duplikat ke service, bukan ke data prospek", async () => {
    beriPermission(["presurvei:create"]);

    await mintaBuat({ ...bodiDasar, abaikanDuplikat: true });

    // Guard sebelum destructure: tanpa ini, `buat` yang tidak terpanggil
    // menghasilkan TypeError saat destructure `mock.calls[0]` alih-alih
    // kegagalan assertion yang bersih.
    expect(mockFns.buat).toHaveBeenCalledTimes(1);
    const [dataProspek, opsi] = mockFns.buat.mock.calls[0];
    expect(dataProspek).not.toHaveProperty("abaikanDuplikat");
    expect(opsi).toMatchObject({ abaikanDuplikat: true });
  });

  it("menolak pemanggil tanpa permission apa pun", async () => {
    beriPermission([]);

    const response = await mintaBuat(bodiDasar);

    expect(response.status).toBe(403);
    expect(mockFns.buat).not.toHaveBeenCalled();
  });
});
