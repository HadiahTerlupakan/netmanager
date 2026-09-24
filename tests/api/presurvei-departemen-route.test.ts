import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `GET /api/admin/presurvei/departemen` dari route sampai query.
 *
 * Service dan repository TIDAK di-mock — hanya `prisma.departments.findMany`,
 * lewat tiruan yang menyaring penghuni dua tenant sesuai `where` yang
 * diterimanya. Tiruan tidak memasang ekstensi tenant, meniru konteks super
 * admin di mana ekstensi tidak menyaring apa pun: tenant wajib datang dari
 * `where` yang ditulis repository.
 */

interface DepartemenTiruan {
  id: string;
  name: string;
  tenantId: string | null;
  description: string | null;
}

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  penghuni: [] as DepartemenTiruan[],
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
    departments: {
      findMany: vi.fn(
        async (args: {
          where: Record<string, unknown>;
          select: Record<string, boolean>;
        }) =>
          mockFns.penghuni
            .filter((departemen) =>
              Object.entries(args.where).every(
                ([kolom, nilai]) =>
                  departemen[kolom as keyof DepartemenTiruan] === nilai,
              ),
            )
            .map((departemen) =>
              Object.fromEntries(
                Object.keys(args.select).map((kolom) => [
                  kolom,
                  departemen[kolom as keyof DepartemenTiruan],
                ]),
              ),
            ),
      ),
    },
  },
}));

import { prisma } from "@/modules/database";
import { GET } from "@/app/api/admin/presurvei/departemen/route";

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
  GET(
    new NextRequest(`http://localhost/api/admin/presurvei/departemen${query}`),
    { params: Promise.resolve({}) } as never,
  );

describe("GET /api/admin/presurvei/departemen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.penghuni.length = 0;
    mockFns.penghuni.push(
      {
        id: "dept-a-teknik",
        name: "Teknik",
        tenantId: "tenant-a",
        description: "rahasia internal A",
      },
      {
        id: "dept-a-cs",
        name: "Customer Service",
        tenantId: "tenant-a",
        description: null,
      },
      {
        id: "dept-b-marketing",
        name: "Marketing B",
        tenantId: "tenant-b",
        description: null,
      },
      {
        id: "dept-global",
        name: "Global",
        tenantId: null,
        description: null,
      },
    );
  });

  it("hanya departemen tenant sesi, terurut nama, berbentuk { id, nama }", async () => {
    beriSesi(["presurvei:read"]);

    const res = await minta();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([
      { id: "dept-a-cs", nama: "Customer Service" },
      { id: "dept-a-teknik", nama: "Teknik" },
    ]);
    expect(JSON.stringify(body)).not.toContain("rahasia internal A");
  });

  it("memakai tenant sesi, bukan tenant bawaan apa pun", async () => {
    beriSesi(["presurvei:read"], "tenant-b");

    const body = await (await minta()).json();

    expect(body.data).toEqual([
      { id: "dept-b-marketing", nama: "Marketing B" },
    ]);
  });

  it("mengabaikan tenantId dari query string", async () => {
    beriSesi(["presurvei:read"]);

    const body = await (await minta("?tenantId=tenant-b")).json();

    expect(
      body.data.map((departemen: { id: string }) => departemen.id),
    ).toEqual(["dept-a-cs", "dept-a-teknik"]);
    expect(JSON.stringify(body)).not.toContain("dept-b-marketing");
  });

  it("membalas 400 tanpa menyentuh database saat sesi tidak bertenant", async () => {
    beriSesiTanpaTenant(["presurvei:read"]);

    const res = await minta();

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("TENANT_ID_REQUIRED");
    expect(prisma.departments.findMany).not.toHaveBeenCalled();
  });

  it.each(["presurvei_target:read", "presurvei_laporan:read"])(
    "terbuka untuk pemegang %s",
    async (permission) => {
      beriSesi([permission]);

      expect((await minta()).status).toBe(200);
    },
  );

  it("tertutup untuk pemegang permission mobile saja, dan untuk department:read", async () => {
    // Endpoint presurvei tidak menuntut izin modul lain — dan sebaliknya izin
    // modul departemen tidak membuka endpoint ini.
    for (const permission of ["m_presurvei:read", "department:read"]) {
      beriSesi([permission]);
      expect((await minta()).status, permission).toBe(403);
    }
    expect(prisma.departments.findMany).not.toHaveBeenCalled();
  });
});
