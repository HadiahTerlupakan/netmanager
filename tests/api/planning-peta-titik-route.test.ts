import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Wiring izin `GET /api/planning/[id]/peta/titik`.
 *
 * `?lingkup=semua` mengembalikan enumerasi topologi operasional (nama,
 * koordinat, splitter, catatan seluruh OLT/ODC/ODP/pole/joinbox satu tenant),
 * jadi ia menuntut `map:read` DI ATAS `planning:read`. Keputusan itu diambil di
 * route dengan `permissionListAllows` dan diserahkan ke service sebagai
 * boolean — satu baris yang tidak bisa dijaga oleh tes service (ia hanya
 * melihat boolean yang sudah jadi) maupun tes komponen (ia memalsukan `fetch`).
 *
 * Yang dikunci di sini adalah NAMA izin dan POSISI argumennya. Karena itu
 * pemeriksaannya `toHaveBeenCalledWith` pada service, bukan status respons:
 * salah ketik nama izin, argumen tertukar, atau `diizinkanNodeNyata` yang
 * terhardcode `true` semuanya menghasilkan 200 yang terlihat sehat.
 *
 * Yang dimock adalah `next-auth` + `@/lib/auth` (sumber izin sesi yang dibaca
 * `createHandler`), bukan `@/lib/rbac` — mem-mock RBAC akan ikut mematikan
 * fungsi yang justru sedang diuji.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  ambilPeta: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockFns.getServerSession }));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/modules/planning", async (importActual) => {
  const actual = await importActual<typeof import("@/modules/planning")>();
  return { ...actual, planningPetaService: { ambilPeta: mockFns.ambilPeta } };
});

import { GET } from "@/app/api/planning/[id]/peta/titik/route";
import type {
  JalurRencanaDTO,
  TitikRencanaDTO,
} from "@/modules/planning/client";

const ID_RENCANA = "plan-1";
const TENANT = "tenant-1";

const KONTEKS_ROUTE = { params: Promise.resolve({ id: ID_RENCANA }) };

const titikRencana: TitikRencanaDTO = {
  nodeId: "node-1",
  planningId: ID_RENCANA,
  type: "odp",
  name: "ODP-CPN-01",
  latitude: -6.2,
  longitude: 106.8,
  splitter: "1:8",
  notes: null,
  isPlanned: true,
};

const jalurRencana: JalurRencanaDTO = {
  edgeId: "edge-1",
  planningId: ID_RENCANA,
  source: "node-1",
  target: "node-2",
  fiberType: "feeder",
  waypoints: [],
  distance: 200,
  notes: null,
  isPlanned: true,
};

function buatRequest(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/planning/${ID_RENCANA}/peta/titik${query}`,
  );
}

function sesiDenganIzin(permissions: string[]): void {
  mockFns.getServerSession.mockResolvedValue({
    user: {
      id: "user-1",
      email: "a@example.com",
      tenantId: TENANT,
      isSuperAdmin: false,
      permissions,
    },
  });
}

/** Argumen opsi (parameter ketiga) yang diterima service pada pemanggilan terakhir. */
function opsiYangDiterimaService(): Record<string, unknown> {
  const panggilan = mockFns.ambilPeta.mock.calls.at(-1);
  if (!panggilan) throw new Error("service tidak pernah dipanggil");
  return panggilan[2] as Record<string, unknown>;
}

describe("GET /api/planning/[id]/peta/titik", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sesiDenganIzin(["planning:read"]);
    mockFns.ambilPeta.mockResolvedValue({
      titik: [titikRencana],
      jalur: [jalurRencana],
      nodeNyata: [],
      latarDisembunyikanKarenaIzin: true,
    });
  });

  it("meneruskan diizinkanNodeNyata true untuk sesi yang punya map:read", async () => {
    sesiDenganIzin(["planning:read", "map:read"]);

    const response = await GET(buatRequest("?lingkup=semua"), KONTEKS_ROUTE);

    expect(response.status).toBe(200);
    expect(mockFns.ambilPeta).toHaveBeenCalledWith(ID_RENCANA, TENANT, {
      sertakanNodeNyata: true,
      diizinkanNodeNyata: true,
    });
  });

  it("meneruskan diizinkanNodeNyata false tanpa map:read, dan tetap menjawab 200 dengan titik serta jalur rencana", async () => {
    // 403 di sini akan mematikan seluruh peta rencana: endpoint ini
    // satu-satunya sumber titik dan jalur. Yang benar adalah degradasi
    // berpenanda, bukan penolakan.
    const response = await GET(buatRequest("?lingkup=semua"), KONTEKS_ROUTE);

    expect(response.status).toBe(200);
    expect(mockFns.ambilPeta).toHaveBeenCalledWith(ID_RENCANA, TENANT, {
      sertakanNodeNyata: true,
      diizinkanNodeNyata: false,
    });

    const badan = await response.json();
    expect(badan.data.titik).toHaveLength(1);
    expect(badan.data.jalur).toHaveLength(1);
    expect(badan.data.latarDisembunyikanKarenaIzin).toBe(true);
  });

  it("tidak meminta latar bila lingkup tidak diminta", async () => {
    sesiDenganIzin(["planning:read", "map:read"]);

    const response = await GET(buatRequest(), KONTEKS_ROUTE);

    expect(response.status).toBe(200);
    expect(opsiYangDiterimaService().sertakanNodeNyata).toBe(false);
  });

  it("memperlakukan nilai lingkup lain seperti tidak diminta", async () => {
    sesiDenganIzin(["planning:read", "map:read"]);

    await GET(buatRequest("?lingkup=rencana"), KONTEKS_ROUTE);

    expect(opsiYangDiterimaService().sertakanNodeNyata).toBe(false);
  });

  it("mengizinkan latar untuk super admin tanpa izin tersurat", async () => {
    // `permissionListAllows` meloloskan super admin; kalau route berhenti
    // memakainya dan memeriksa daftar izin sendiri, kasus ini yang jatuh.
    mockFns.getServerSession.mockResolvedValue({
      user: {
        id: "user-super",
        email: "super@example.com",
        tenantId: TENANT,
        isSuperAdmin: true,
        permissions: ["planning:read"],
      },
    });

    await GET(buatRequest("?lingkup=semua"), KONTEKS_ROUTE);

    expect(opsiYangDiterimaService().diizinkanNodeNyata).toBe(true);
  });

  it("menolak sesi tanpa planning:read dan tidak memanggil service", async () => {
    sesiDenganIzin(["map:read"]);

    const response = await GET(buatRequest("?lingkup=semua"), KONTEKS_ROUTE);

    expect(response.status).toBe(403);
    expect(mockFns.ambilPeta).not.toHaveBeenCalled();
  });
});
