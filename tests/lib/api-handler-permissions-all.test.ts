import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `HandlerOptions.permissions` adalah gerbang "SALAH SATU DARI": menambahkan
 * izin kedua di sana justru MELONGGARKAN akses. `permissionsAll` adalah
 * gerbang "DAN"-nya.
 *
 * Tes ini mengunci perbedaan itu di tingkat `createHandler`, bukan lewat satu
 * route saja — sebelumnya jebakan ATAU hanya terdokumentasi sebagai komentar
 * di dua route, dan penulis route ketiga tidak punya apa pun yang menahannya.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockFns.getServerSession }));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

import { createHandler, apiSuccess } from "@/lib/api";

const KONTEKS_ROUTE = { params: Promise.resolve({}) };

function buatRequest(): NextRequest {
  return new NextRequest("http://localhost/api/uji", { method: "POST" });
}

function sesiDenganIzin(permissions: string[], isSuperAdmin = false): void {
  mockFns.getServerSession.mockResolvedValue({
    user: {
      id: "user-1",
      email: "a@example.com",
      tenantId: "tenant-1",
      isSuperAdmin,
      permissions,
    },
  });
}

const dijalankan = vi.fn();

const HANDLER_DAN = createHandler(
  { auth: true, permissionsAll: ["planning:update", "map:create"] },
  async () => {
    dijalankan();
    return apiSuccess({ ok: true });
  },
);

const HANDLER_ATAU = createHandler(
  { auth: true, permissions: ["planning:update", "map:create"] },
  async () => {
    dijalankan();
    return apiSuccess({ ok: true });
  },
);

describe("createHandler permissionsAll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("meloloskan hanya bila seluruh izin dimiliki", async () => {
    sesiDenganIzin(["planning:update", "map:create"]);

    const response = await HANDLER_DAN(buatRequest(), KONTEKS_ROUTE);

    expect(response.status).toBe(200);
    expect(dijalankan).toHaveBeenCalledTimes(1);
  });

  it.each([["planning:update"], ["map:create"]])(
    "menolak 403 bila hanya punya %s",
    async (izin) => {
      sesiDenganIzin([izin]);

      const response = await HANDLER_DAN(buatRequest(), KONTEKS_ROUTE);

      expect(response.status).toBe(403);
      expect(dijalankan).not.toHaveBeenCalled();
    },
  );

  it("menyebut izin yang kurang pada pesan 403", async () => {
    sesiDenganIzin(["planning:update"]);

    const response = await HANDLER_DAN(buatRequest(), KONTEKS_ROUTE);
    const badan = await response.json();

    expect(badan.error).toContain("map:create");
    expect(badan.error).not.toContain("planning:update");
  });

  it("meloloskan wildcard `*`", async () => {
    sesiDenganIzin(["*"]);

    const response = await HANDLER_DAN(buatRequest(), KONTEKS_ROUTE);

    expect(response.status).toBe(200);
  });

  it("meloloskan super admin tanpa izin tersurat", async () => {
    sesiDenganIzin([], true);

    const response = await HANDLER_DAN(buatRequest(), KONTEKS_ROUTE);

    expect(response.status).toBe(200);
  });

  it("gerbang `permissions` yang setara justru meloloskan satu izin saja", async () => {
    // Inilah jebakannya, dikunci sebagai perilaku: daftar yang sama di
    // `permissions` membuat pemegang `map:create` saja ikut lolos. Siapa pun
    // yang mengubah salah satu gerbang akan membuat tes ini bicara.
    sesiDenganIzin(["map:create"]);

    const response = await HANDLER_ATAU(buatRequest(), KONTEKS_ROUTE);

    expect(response.status).toBe(200);
  });
});
