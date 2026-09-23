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

/** Prospek tiruan: hanya kolom yang dibaca mapper. */
interface ProspekTiruan {
  id: string;
  tenantId: string | null;
}

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  penghuni: [] as PenggunaTiruan[],
  prospek: [] as ProspekTiruan[],
}));

vi.mock("next-auth", () => ({
  getServerSession: mockFns.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  authConfig: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

/** Baris Prisma lengkap dari prospek tiruan, atau null. */
function barisProspekTiruan(prospek: ProspekTiruan | undefined) {
  if (!prospek) return null;
  const waktu = new Date("2026-09-23T00:00:00.000Z");
  return {
    nama: "Budi",
    noTelp: "081234567890",
    email: null as string | null,
    alamat: "Jl. Merdeka 10",
    latitude: null as number | null,
    longitude: null as number | null,
    shareloc: null as string | null,
    sumber: "WALK_IN",
    iklanId: null as string | null,
    registrationId: null as string | null,
    referralNama: null as string | null,
    status: "BARU",
    pemilikId: null as string | null,
    paketDiminati: null as string | null,
    catatan: null as string | null,
    canvasingId: null as string | null,
    konversiAt: null as Date | null,
    siteId: null as string | null,
    createdAt: waktu,
    updatedAt: waktu,
    pemilik: null as null,
    ...prospek,
  };
}

vi.mock("@/modules/database", () => ({
  prisma: {
    // Tiruan tidak memasang ekstensi tenant, meniru konteks super admin di
    // mana ekstensi tidak menyaring apa pun. Penolakan prospek tenant lain
    // untuk pemanggil biasa karenanya harus datang dari `where` yang ditulis
    // repository (`findByIdDalamCakupan`), bukan dari ekstensi saja.
    presurveiProspek: {
      // `findFirst` menyaring `where` apa adanya (id DAN tenantId), jadi
      // repository yang lupa menulis `tenantId` membuat prospek tenant lain
      // kembali ke pemanggil biasa.
      findFirst: vi.fn(
        async (args: { where: { id: string; tenantId?: string } }) =>
          barisProspekTiruan(
            mockFns.prospek.find((p) =>
              Object.entries(args.where).every(
                ([kolom, nilai]) => p[kolom as keyof ProspekTiruan] === nilai,
              ),
            ),
          ),
      ),
      findUnique: vi.fn(async (args: { where: { id: string } }) =>
        barisProspekTiruan(mockFns.prospek.find((p) => p.id === args.where.id)),
      ),
    },
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

/** Id prospek berbentuk UUID, seperti `PresurveiProspek.id` (`@default(uuid())`). */
const PROSPEK_A = "0b8f3a52-5c7e-4d8a-9f1e-2a6b7c8d9e01";
const PROSPEK_B = "1c9e4b63-6d8f-4e9b-8a2f-3b7c8d9e0f12";
const PROSPEK_YATIM = "2dae5c74-7e90-4fac-9b30-4c8d9e0f1a23";
const PROSPEK_HANTU = "3ebf6d85-8fa1-4abd-8c41-5d9e0f1a2b34";

const beriSesiSuperAdmin = (tenantId?: string): void => {
  mockFns.getServerSession.mockResolvedValue({
    user: {
      id: "root",
      email: "root@contoh.id",
      isSuperAdmin: true,
      permissions: ["*"],
      ...(tenantId ? { tenantId } : {}),
    },
  });
};

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

describe("GET /api/admin/presurvei/sales?prospekId= — tenant dari prospek", () => {
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
        id: "sales-b-citra",
        name: "Citra",
        email: "citra@b.id",
        tenantId: "tenant-b",
        isSales: true,
        isActive: true,
      },
    );
    mockFns.prospek.length = 0;
    mockFns.prospek.push(
      { id: PROSPEK_A, tenantId: "tenant-a" },
      { id: PROSPEK_B, tenantId: "tenant-b" },
      { id: PROSPEK_YATIM, tenantId: null },
    );
  });

  it("memberi pemanggil biasa sales tenant prospeknya sendiri", async () => {
    beriSesi(["presurvei:read"], "tenant-a");

    const res = await minta(`?prospekId=${PROSPEK_A}`);

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([
      { id: "sales-a-rina", nama: "Rina" },
    ]);
  });

  it("membalas 404 generik untuk pemanggil biasa + prospek tenant lain", async () => {
    beriSesi(["presurvei:read"], "tenant-a");

    const res = await minta(`?prospekId=${PROSPEK_B}`);
    const teks = JSON.stringify(await res.json());

    expect(res.status).toBe(404);
    expect(teks).not.toContain("sales-b-citra");
    expect(teks).not.toContain("tenant-b");
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("membalas 404 untuk prospek yang tidak ada", async () => {
    beriSesi(["presurvei:read"], "tenant-a");

    expect((await minta(`?prospekId=${PROSPEK_HANTU}`)).status).toBe(404);
  });

  it("memberi super admin bertenant sesi A sales tenant PROSPEK (B)", async () => {
    beriSesiSuperAdmin("tenant-a");

    const res = await minta(`?prospekId=${PROSPEK_B}`);

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([
      { id: "sales-b-citra", nama: "Citra" },
    ]);
  });

  it("melayani super admin tanpa tenant sesi lewat tenant prospek", async () => {
    beriSesiSuperAdmin();

    const res = await minta(`?prospekId=${PROSPEK_B}`);

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([
      { id: "sales-b-citra", nama: "Citra" },
    ]);
  });

  it("tidak pernah mengambil tenant dari query string", async () => {
    beriSesi(["presurvei:read"], "tenant-a");
    const denganProspek = await (
      await minta(`?prospekId=${PROSPEK_A}&tenantId=tenant-b`)
    ).json();
    beriSesiSuperAdmin("tenant-a");
    const superAdmin = await (
      await minta(`?prospekId=${PROSPEK_A}&tenantId=tenant-b`)
    ).json();

    expect(denganProspek.data).toEqual([{ id: "sales-a-rina", nama: "Rina" }]);
    expect(superAdmin.data).toEqual([{ id: "sales-a-rina", nama: "Rina" }]);
  });

  it("membalas 404, bukan 422, bagi pemanggil biasa atas prospek tanpa tenant", async () => {
    // Prospek tanpa tenant bukan milik tenant pemanggil; 422 akan membocorkan
    // bahwa prospek itu ada.
    beriSesi(["presurvei:read"], "tenant-a");

    expect((await minta(`?prospekId=${PROSPEK_YATIM}`)).status).toBe(404);
  });

  it.each(["bukan-uuid", "", "prospek-a' OR 1=1"])(
    "menolak prospekId tidak valid %j dengan 400 tanpa menyentuh database",
    async (prospekId) => {
      beriSesiSuperAdmin();

      const res = await minta(`?prospekId=${encodeURIComponent(prospekId)}`);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(prisma.presurveiProspek.findUnique).not.toHaveBeenCalled();
      expect(prisma.presurveiProspek.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    },
  );

  it("membalas 422 PROSPEK_TANPA_TENANT untuk prospek tanpa tenant", async () => {
    beriSesiSuperAdmin();

    const res = await minta(`?prospekId=${PROSPEK_YATIM}`);

    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("PROSPEK_TANPA_TENANT");
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
