import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  selesaikanTautanPendek: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockFns.getServerSession }));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/lib/geo/tautan-peta-pendek", () => ({
  selesaikanTautanPendek: mockFns.selesaikanTautanPendek,
}));

import { POST } from "@/app/api/planning/tautan-peta/uraikan/route";

const KONTEKS_ROUTE = { params: Promise.resolve({}) };

function buatRequest(tautan: string) {
  return new NextRequest("http://localhost/api/planning/tautan-peta/uraikan", {
    method: "POST",
    body: JSON.stringify({ tautan }),
    headers: { "content-type": "application/json" },
  });
}

function sesiDenganIzin(permissions: string[]) {
  mockFns.getServerSession.mockResolvedValue({
    user: { id: "user-1", email: "a@example.com", permissions },
  });
}

describe("POST /api/planning/tautan-peta/uraikan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sesiDenganIzin(["planning:update"]);
  });

  it("menjawab 200 untuk tautan panjang tanpa permintaan keluar", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await POST(
      buatRequest("https://www.google.com/maps?q=-6.2,106.8"),
      KONTEKS_ROUTE,
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockFns.selesaikanTautanPendek).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("menyerahkan tautan pendek ke penyelesai", async () => {
    mockFns.selesaikanTautanPendek.mockResolvedValue({
      status: "berhasil",
      latitude: -6.2,
      longitude: 106.8,
    });

    const response = await POST(
      buatRequest("https://maps.app.goo.gl/abc"),
      KONTEKS_ROUTE,
    );

    expect(response.status).toBe(200);
    expect(mockFns.selesaikanTautanPendek).toHaveBeenCalledWith(
      "https://maps.app.goo.gl/abc",
    );
  });

  it("menolak pengguna tanpa planning:update dengan 403", async () => {
    sesiDenganIzin(["planning:read"]);

    const response = await POST(
      buatRequest("https://www.google.com/maps?q=-6.2,106.8"),
      KONTEKS_ROUTE,
    );

    expect(response.status).toBe(403);
    expect(mockFns.selesaikanTautanPendek).not.toHaveBeenCalled();
  });
});
