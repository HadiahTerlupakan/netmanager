import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
}));

// Peta domain adalah data bootstrap lintas-tenant, jadi resolver wajib memakai
// `prismaAuth` (tanpa ekstensi isolasi). Mock ini sekaligus menjaga kontrak itu:
// kalau resolver pindah ke `prisma`, test gagal karena export-nya tidak ada.
vi.mock("@/modules/database", () => ({
  prismaAuth: {
    tenantDomain: {
      findFirst: mockFns.findFirst,
      findUnique: mockFns.findUnique,
    },
  },
}));

import { resolveTenantByPublicHost } from "@/modules/tenant";

const ORIGINAL_DOMAIN = process.env.DOMAIN;

describe("resolveTenantByPublicHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DOMAIN = "radpro.id";
    mockFns.findFirst.mockResolvedValue(null);
    mockFns.findUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env.DOMAIN = ORIGINAL_DOMAIN;
  });

  it.each(["localhost", "127.0.0.1", "::1", "[::1]"])(
    "mengembalikan null tanpa query untuk host loopback %s",
    async (host) => {
      await expect(resolveTenantByPublicHost(host)).resolves.toBeNull();

      expect(mockFns.findUnique).not.toHaveBeenCalled();
      expect(mockFns.findFirst).not.toHaveBeenCalled();
    },
  );

  it.each(["127.0.0.1:3000", "[::1]:3000", "LOCALHOST:3000"])(
    "memperlakukan host loopback berport %s sama dengan tanpa port",
    async (host) => {
      await expect(resolveTenantByPublicHost(host)).resolves.toBeNull();

      expect(mockFns.findUnique).not.toHaveBeenCalled();
      expect(mockFns.findFirst).not.toHaveBeenCalled();
    },
  );

  it("tidak merusak IPv6 berkurung saat memotong port", async () => {
    mockFns.findFirst.mockResolvedValue(null);

    await expect(
      resolveTenantByPublicHost("[2001:db8::1]:8443"),
    ).resolves.toBeNull();

    expect(mockFns.findFirst).toHaveBeenCalledWith({
      where: { domain: "2001:db8::1", status: "active" },
      select: { tenantId: true, slug: true },
    });
  });

  it("mengembalikan null tanpa query untuk apex domain", async () => {
    await expect(resolveTenantByPublicHost("radpro.id")).resolves.toBeNull();

    expect(mockFns.findUnique).not.toHaveBeenCalled();
    expect(mockFns.findFirst).not.toHaveBeenCalled();
  });

  it("mencari tenant lewat slug untuk subdomain base domain", async () => {
    mockFns.findUnique.mockResolvedValue({
      tenantId: "tenant-1",
      slug: "tenant-a",
    });

    await expect(
      resolveTenantByPublicHost("tenant-a.radpro.id"),
    ).resolves.toEqual({ tenantId: "tenant-1", slug: "tenant-a" });

    expect(mockFns.findUnique).toHaveBeenCalledWith({
      where: { slug: "tenant-a" },
      select: { tenantId: true, slug: true },
    });
    expect(mockFns.findFirst).not.toHaveBeenCalled();
  });

  it("menolak subdomain bertingkat tanpa menyentuh database", async () => {
    await expect(
      resolveTenantByPublicHost("a.b.radpro.id"),
    ).resolves.toBeNull();

    expect(mockFns.findUnique).not.toHaveBeenCalled();
    expect(mockFns.findFirst).not.toHaveBeenCalled();
  });

  it("mencari custom domain yang aktif", async () => {
    mockFns.findFirst.mockResolvedValue({
      tenantId: "tenant-2",
      slug: "tenant-b",
    });

    await expect(
      resolveTenantByPublicHost("billing.tenant-b.com"),
    ).resolves.toEqual({ tenantId: "tenant-2", slug: "tenant-b" });

    expect(mockFns.findFirst).toHaveBeenCalledWith({
      where: { domain: "billing.tenant-b.com", status: "active" },
      select: { tenantId: true, slug: true },
    });
  });

  it("mengembalikan null untuk host yang belum terdaftar, bukan melempar error", async () => {
    await expect(
      resolveTenantByPublicHost("belum-terdaftar.com"),
    ).resolves.toBeNull();
  });

  it("mengembalikan null untuk host kosong atau tidak ada", async () => {
    await expect(resolveTenantByPublicHost(null)).resolves.toBeNull();
    await expect(resolveTenantByPublicHost("")).resolves.toBeNull();
    await expect(resolveTenantByPublicHost("   ")).resolves.toBeNull();

    expect(mockFns.findFirst).not.toHaveBeenCalled();
  });

  it("menghormati DOMAIN dari environment", async () => {
    process.env.DOMAIN = "contoh.test";
    mockFns.findUnique.mockResolvedValue({
      tenantId: "tenant-3",
      slug: "tenant-c",
    });

    await expect(
      resolveTenantByPublicHost("tenant-c.contoh.test"),
    ).resolves.toEqual({ tenantId: "tenant-3", slug: "tenant-c" });

    expect(mockFns.findUnique).toHaveBeenCalledWith({
      where: { slug: "tenant-c" },
      select: { tenantId: true, slug: true },
    });
  });
});
