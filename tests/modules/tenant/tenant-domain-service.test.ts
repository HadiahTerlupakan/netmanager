import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tanpa baris `TenantDomain`, tenant tidak punya subdomain slug maupun jalur
 * domain kustom — seluruh alur verifikasi dan SSL membaca tabel yang sama.
 * Terverifikasi di produksi: tidak ada satu pun baris yang pernah dibuat karena
 * `createForTenant` tidak pernah dipanggil, sehingga
 * `POST /api/admin/tenants/<id>/domains` selalu membalas 404.
 */

const db = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    tenantDomain: {
      findUnique: db.findUnique,
      findMany: db.findMany,
      create: db.create,
      update: db.update,
      delete: db.delete,
    },
  },
}));

const { TenantDomainService } = await import("@/modules/tenant");

/** Baris tenantDomain yang cukup untuk keperluan tes. */
const row = (over: Record<string, unknown> = {}) => ({
  id: "row-1",
  tenantId: "tenant-1",
  slug: "akses-cepat",
  domain: null as string | null,
  status: "pending",
  sslStatus: "pending",
  ...over,
});

/** findUnique dipakai untuk lookup by tenantId, slug, dan domain sekaligus. */
const whenLookup = (
  handler: (where: Record<string, unknown>) => unknown | null,
) => {
  db.findUnique.mockImplementation(
    async ({ where }: { where: Record<string, unknown> }) => handler(where),
  );
};

let service: InstanceType<typeof TenantDomainService>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DOMAIN = "radpro.id";
  db.create.mockImplementation(async ({ data }: { data: unknown }) => data);
  db.update.mockImplementation(
    async ({ where, data }: { where: unknown; data: unknown }) => ({
      ...(where as object),
      ...(data as object),
    }),
  );
  service = new TenantDomainService();
});

describe("ensureForTenant", () => {
  it("mengembalikan baris yang sudah ada tanpa membuat baru", async () => {
    whenLookup((where) => (where.tenantId ? row() : null));

    const result = await service.ensureForTenant("tenant-1", "Akses Cepat");

    expect(result).toEqual(row());
    expect(db.create).not.toHaveBeenCalled();
  });

  it("membuat baris dengan slug turunan nama tenant", async () => {
    whenLookup(() => null);

    await service.ensureForTenant("tenant-1", "Akses Cepat Nusantara");

    expect(db.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-1", slug: "akses-cepat-nusantara" },
    });
  });

  // Slug portal akan ditulis ulang `proxy.ts` sehingga tenantnya tidak pernah
  // bisa diakses lewat subdomain itu.
  it("melewati slug yang dipesan portal", async () => {
    whenLookup(() => null);

    await service.ensureForTenant("tenant-1", "Admin");

    expect(db.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-1", slug: "admin-1" },
    });
  });

  it("memberi pembeda saat slug sudah dipakai tenant lain", async () => {
    whenLookup((where) => {
      if (where.tenantId) return null;
      return where.slug === "akses-cepat" ? row() : null;
    });

    await service.ensureForTenant("tenant-2", "Akses Cepat");

    expect(db.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-2", slug: "akses-cepat-1" },
    });
  });
});

describe("createForTenant", () => {
  it("menolak slug yang dipesan portal", async () => {
    whenLookup(() => null);

    await expect(
      service.createForTenant("tenant-1", "pelanggan"),
    ).rejects.toThrow(/dipesan/i);
    expect(db.create).not.toHaveBeenCalled();
  });

  it("menolak slug yang sudah dipakai", async () => {
    whenLookup((where) => (where.slug === "akses-cepat" ? row() : null));

    await expect(
      service.createForTenant("tenant-2", "akses-cepat"),
    ).rejects.toThrow(/sudah dipakai/i);
  });
});

describe("setCustomDomain", () => {
  it("menormalkan domain sebelum disimpan", async () => {
    whenLookup(() => null);

    await service.setCustomDomain("row-1", "  Portal.Klien.COM.  ");

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ domain: "portal.klien.com" }),
      }),
    );
  });

  // Host di bawah domain kita sendiri bertabrakan dengan subdomain slug dan
  // portal; sertifikatnya pun sudah ditangani sertifikat utama.
  it.each(["portal.radpro.id", "radpro.id"])(
    "menolak %s sebagai domain kustom",
    async (domain) => {
      whenLookup(() => null);

      await expect(service.setCustomDomain("row-1", domain)).rejects.toThrow(
        /tidak boleh berada di bawah/i,
      );
    },
  );

  it("menolak domain yang sudah dipakai baris lain", async () => {
    whenLookup((where) =>
      where.domain === "portal.klien.com" ? row({ id: "row-lain" }) : null,
    );

    await expect(
      service.setCustomDomain("row-1", "portal.klien.com"),
    ).rejects.toThrow(/sudah dipakai/i);
  });

  it("mengizinkan menyimpan ulang domain milik baris itu sendiri", async () => {
    whenLookup((where) =>
      where.domain === "portal.klien.com" ? row({ id: "row-1" }) : null,
    );

    await expect(
      service.setCustomDomain("row-1", "portal.klien.com"),
    ).resolves.toBeTruthy();
  });
});

/**
 * `/api/admin/tenant-domains/[id]/disable` mengirim id baris, sedangkan
 * `disableDomain` mencarinya lewat `findByTenantId` — selalu meleset, jadi
 * tombol nonaktifkan diam-diam tidak melakukan apa pun.
 */
describe("disableDomain", () => {
  it("mencari baris berdasarkan id baris, bukan tenantId", async () => {
    whenLookup((where) => (where.id === "row-1" ? row() : null));

    await service.disableDomain("row-1");

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "row-1" },
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
  });

  it("tidak mengubah apa pun saat baris tidak ada", async () => {
    whenLookup(() => null);

    await service.disableDomain("row-tidak-ada");

    expect(db.update).not.toHaveBeenCalled();
  });
});
