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

  it("menolak permintaan tanpa sesi dan tidak memanggil penyelesai", async () => {
    mockFns.getServerSession.mockResolvedValue(null);

    const response = await POST(
      buatRequest("https://maps.app.goo.gl/abc"),
      KONTEKS_ROUTE,
    );

    expect(response.status).toBe(401);
    expect(mockFns.selesaikanTautanPendek).not.toHaveBeenCalled();
  });

  it("membatasi laju penukaran tautan pendek dengan 429", async () => {
    mockFns.selesaikanTautanPendek.mockResolvedValue({
      status: "gagal",
      alasan: "x",
    });
    sesiDenganIzin(["planning:update"]);
    mockFns.getServerSession.mockResolvedValue({
      user: {
        id: "user-batas",
        email: "b@example.com",
        permissions: ["planning:update"],
      },
    });

    let status = 0;
    for (let i = 0; i < 25; i += 1) {
      status = (
        await POST(buatRequest("https://maps.app.goo.gl/abc"), KONTEKS_ROUTE)
      ).status;
    }

    expect(status).toBe(429);
    expect(mockFns.selesaikanTautanPendek.mock.calls.length).toBeLessThan(25);
  });
});
