import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Wiring izin `GET /api/settings/maps`.
 *
 * Sengaja tanpa izin apa pun. Peta muncul di layar yang penggunanya belum
 * tentu punya `map:read` — pemilih koordinat pelanggan PPP, Site Work Order,
 * live-map kehadiran, peta presurvei. Menggantungkan API key pada `map:read`
 * akan mengulang jebakan yang sudah pernah diperbaiki di peta rencana OSP:
 * petanya tampak kosong padahal datanya ada, dan tidak ada yang tahu sebabnya.
 *
 * Penulisannya tidak ada di sini: setelan peta ditulis lewat
 * `PUT /api/settings/api` bersama integrasi lain, dikunci `api:update`.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  getGoogleMapsSettingsUntukKlien: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockFns.getServerSession }));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/modules/settings", async (importActual) => {
  const actual = await importActual<typeof import("@/modules/settings")>();
  return {
    ...actual,
    getGoogleMapsSettingsUntukKlien: mockFns.getGoogleMapsSettingsUntukKlien,
  };
});

import { GET } from "@/app/api/settings/maps/route";

const TENANT = "tenant-1";
const SETELAN = {
  enabled: true,
  apiKey: "AIzaKunciUji",
  mapId: "peta-uji-01",
};

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
  mockFns.getUserPermissions.mockResolvedValue(permissions);
}

function requestBaca(): NextRequest {
  return new NextRequest("http://localhost/api/settings/maps");
}

describe("GET /api/settings/maps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getGoogleMapsSettingsUntukKlien.mockResolvedValue(SETELAN);
  });

  it("melayani pengguna tanpa izin peta sama sekali", async () => {
    // Operator yang hanya memegang izin kehadiran tetap membuka live-map.
    sesiDenganIzin(["attendance:read"]);

    const respons = await GET(requestBaca(), { params: Promise.resolve({}) });

    expect(respons.status).toBe(200);
    expect((await respons.json()).data).toEqual(SETELAN);
  });

  it("membaca setelan milik tenant sesi", async () => {
    sesiDenganIzin(["attendance:read"]);

    await GET(requestBaca(), { params: Promise.resolve({}) });

    expect(mockFns.getGoogleMapsSettingsUntukKlien).toHaveBeenCalledWith(
      TENANT,
    );
  });

  it("memakai varian untuk klien, yang menahan key saat belum siap", async () => {
    // Bukan `getGoogleMapsSettings` — varian itu mengembalikan nilai apa
    // adanya untuk form administrator, termasuk saat fiturnya dimatikan.
    sesiDenganIzin(["attendance:read"]);

    await GET(requestBaca(), { params: Promise.resolve({}) });

    expect(mockFns.getGoogleMapsSettingsUntukKlien).toHaveBeenCalledTimes(1);
  });

  it("tetap menolak pengunjung tanpa sesi", async () => {
    mockFns.getServerSession.mockResolvedValue(null);

    const respons = await GET(requestBaca(), { params: Promise.resolve({}) });

    expect(respons.status).toBe(401);
  });
});
