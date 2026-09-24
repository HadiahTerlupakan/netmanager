import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RingkasanSales } from "@/modules/presurvei";

/**
 * Route ringkasan tidak menerima parameter: pemilik selalu id sesi, tenant
 * selalu tenant sesi. Test ini memastikan masukan klien tidak pernah bisa
 * menunjuk data orang lain, dan pemanggil tanpa izin mobile atau tanpa
 * tenant ditolak sebelum service disentuh.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  ringkasan: vi.fn(),
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
    RingkasanSalesService: class {
      ringkasan = mockFns.ringkasan;
    },
  };
});

import { GET } from "@/app/api/mobile/presurvei/ringkasan/route";

const ID_SESI = "sales-a";
const TENANT_SESI = "tenant-1";

const RINGKASAN: RingkasanSales = {
  tanggal: new Date("2026-09-24T00:00:00.000Z"),
  kegiatanHariIni: {
    KUNJUNGAN: 3,
    SURVEI_LOKASI: 1,
    TELEPON: 4,
    CHAT: 2,
    IKLAN: 0,
  },
  target: null,
  perluFollowUp: [],
};

// `tenantId` memakai sentinel `null` (bukan `undefined`) untuk kasus "tanpa
// tenant": parameter default JS tetap terpakai bila argumen literal
// `undefined` diteruskan, jadi `beriSesi(izin, undefined)` tidak pernah
// benar-benar menghasilkan sesi tanpa tenant.
const beriSesi = (
  permissions: string[],
  tenantId: string | null = TENANT_SESI,
) => {
  mockFns.getServerSession.mockResolvedValue({
    user: {
      id: ID_SESI,
      email: "sales-a@contoh.id",
      permissions,
      tenantId: tenantId ?? undefined,
    },
  });
};

const minta = (query = "") =>
  GET(
    new NextRequest(`http://localhost/api/mobile/presurvei/ringkasan${query}`),
    {
      params: Promise.resolve({}),
    } as never,
  );

describe("GET /api/mobile/presurvei/ringkasan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.ringkasan.mockResolvedValue(RINGKASAN);
  });

  it("mengembalikan ringkasan milik sesi dengan tenant sesi", async () => {
    beriSesi(["m_presurvei:read"]);

    const respons = await minta();

    expect(respons.status).toBe(200);
    expect(mockFns.ringkasan).toHaveBeenCalledWith({
      userId: ID_SESI,
      tenantId: TENANT_SESI,
      sekarang: expect.any(Date),
    });
    expect(await respons.json()).toEqual({
      success: true,
      data: {
        tanggal: "2026-09-24",
        kegiatanHariIni: {
          KUNJUNGAN: 3,
          SURVEI_LOKASI: 1,
          TELEPON: 4,
          CHAT: 2,
          IKLAN: 0,
        },
        target: null,
        perluFollowUp: [],
      },
    });
  });

  it("mengabaikan userId dan tenantId dari query", async () => {
    beriSesi(["m_presurvei:read"]);

    await minta("?userId=sales-b&tenantId=tenant-9");

    expect(mockFns.ringkasan).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ID_SESI, tenantId: TENANT_SESI }),
    );
  });

  it("menolak pemegang izin web saja dengan 403", async () => {
    beriSesi(["presurvei:read"]);

    const respons = await minta();

    expect(respons.status).toBe(403);
    expect(mockFns.ringkasan).not.toHaveBeenCalled();
  });

  it("menolak pemanggil tanpa izin presurvei dengan 403", async () => {
    beriSesi(["m_canvasing:read"]);

    const respons = await minta();

    expect(respons.status).toBe(403);
    expect(mockFns.ringkasan).not.toHaveBeenCalled();
  });

  it("menolak sesi tanpa tenant dengan 400", async () => {
    beriSesi(["*"], null);

    const respons = await minta();

    expect(respons.status).toBe(400);
    expect(mockFns.ringkasan).not.toHaveBeenCalled();
  });
});
