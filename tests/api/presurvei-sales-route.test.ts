import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `GET /api/admin/presurvei/sales` dari route sampai query.
 *
 * Service dan repository TIDAK di-mock — hanya `prisma.user.findMany`, lewat
 * tiruan yang menyaring penghuni dua tenant sesuai `where` yang diterimanya.
 * Dengan begitu test membuktikan tenant sesi benar-benar sampai ke query:
 * membuang `tenantId` di route, service, atau repository membuat sales tenant
 * B muncul di respons tenant A.
 */

interface PenggunaTiruan {
  id: string;
  name: string | null;
  email: string;
  tenantId: string | null;
  isSales: boolean;
  isActive: boolean;
}

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  penghuni: [] as PenggunaTiruan[],
}));

vi.mock("next-auth", () => ({
  getServerSession: mockFns.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  authConfig: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    user: {
      findMany: vi.fn(
        async (args: {
          where: Record<string, unknown>;
          select: Record<string, boolean>;
        }) =>
          mockFns.penghuni
            .filter((pengguna) =>
              Object.entries(args.where).every(
                ([kolom, nilai]) =>
                  pengguna[kolom as keyof PenggunaTiruan] === nilai,
              ),
            )
            .map((pengguna) =>
              Object.fromEntries(
                Object.keys(args.select).map((kolom) => [
                  kolom,
                  pengguna[kolom as keyof PenggunaTiruan],
                ]),
              ),
            ),
      ),
    },
  },
}));

import { prisma } from "@/modules/database";
import { GET } from "@/app/api/admin/presurvei/sales/route";

const beriSesi = (permissions: string[], tenantId = "tenant-a"): void => {
  mockFns.getServerSession.mockResolvedValue({
    user: { id: "admin-a", email: "admin@contoh.id", tenantId, permissions },
  });
};

/** Sesi tanpa `tenantId` sama sekali — bukan `undefined` yang jatuh ke bawaan. */
const beriSesiTanpaTenant = (permissions: string[]): void => {
  mockFns.getServerSession.mockResolvedValue({
    user: { id: "admin-a", email: "admin@contoh.id", permissions },
  });
};

const minta = (query = "") =>
  GET(new NextRequest(`http://localhost/api/admin/presurvei/sales${query}`), {
    params: Promise.resolve({}),
  } as never);

describe("GET /api/admin/presurvei/sales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.penghuni.length = 0;
    mockFns.penghuni.push(
      {
        id: "sales-a-rina",
        name: "Rina",
        email: "rina@a.id",
        tenantId: "tenant-a",
        isSales: true,
        isActive: true,
      },
      {
        id: "sales-a-anonim",
        name: null,
        email: "anonim@a.id",
        tenantId: "tenant-a",
        isSales: true,
        isActive: true,
      },
      {
        id: "sales-b-citra",
        name: "Citra",
        email: "citra@b.id",
        tenantId: "tenant-b",
        isSales: true,
        isActive: true,
      },
    );
  });

  it("hanya mengembalikan sales tenant sesi, tidak sales tenant lain", async () => {
    beriSesi(["presurvei:read"]);

    const res = await minta();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([
      { id: "sales-a-rina", nama: "Rina" },
      { id: "sales-a-anonim", nama: "Tanpa nama (…anonim)" },
    ]);
    expect(JSON.stringify(body)).not.toContain("sales-b-citra");
  });

  it("mengabaikan tenantId dari query string, tetap memakai tenant sesi", async () => {
    // Tenant hanya boleh berasal dari sesi. Refactor "biar super admin bisa
    // memilih tenant" yang membaca query lebih dulu akan membuat admin tenant
    // A menerima daftar sales tenant B lewat `?tenantId=tenant-b`.
    beriSesi(["presurvei:read"]);

    const body = await (await minta("?tenantId=tenant-b")).json();

    expect(body.data.map((sales: { id: string }) => sales.id)).toEqual([
      "sales-a-rina",
      "sales-a-anonim",
    ]);
    expect(JSON.stringify(body)).not.toContain("sales-b-citra");
  });

  it("tidak membawa email siapa pun di respons", async () => {
    beriSesi(["presurvei:read"]);

    const teks = JSON.stringify(await (await minta()).json());

    expect(teks).not.toContain("@a.id");
    expect(teks).not.toContain("@b.id");
  });

  it("memakai tenant sesi, bukan tenant bawaan apa pun", async () => {
    // Pasangan test di atas dengan tenant dibalik: route yang memakukan
    // "tenant-a" di mana pun akan lolos test pertama tapi merah di sini.
    beriSesi(["presurvei:read"], "tenant-b");

    const body = await (await minta()).json();

    expect(body.data).toEqual([{ id: "sales-b-citra", nama: "Citra" }]);
  });

  it("membalas 400 tanpa menyentuh database saat sesi tidak bertenant", async () => {
    // Kondisi yang bisa ditebak (mis. super admin tanpa tenant), bukan
    // kesalahan server: 400 `TENANT_ID_REQUIRED`, bukan 500 yang memicu
    // `logger.error` dan tiga kali percobaan ulang react-query.
    beriSesiTanpaTenant(["presurvei:read"]);

    const res = await minta();
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("TENANT_ID_REQUIRED");
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it.each(["presurvei_target:read", "presurvei_laporan:read"])(
    "terbuka untuk pemegang %s",
    async (permission) => {
      beriSesi([permission]);

      expect((await minta()).status).toBe(200);
    },
  );

  it("tertutup untuk sales lapangan yang hanya memegang permission mobile", async () => {
    beriSesi(["m_presurvei:read"]);

    const res = await minta();

    expect(res.status).toBe(403);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
