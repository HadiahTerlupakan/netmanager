import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sertifikat yang diterbitkan cert-manager hanya tersimpan sebagai Secret.
 * Traefik menyajikan sebuah sertifikat hanya bila ada route yang merujuk
 * Secret itu, dan IngressRoute catch-all memakai `tls: {}` tanpa `secretName`.
 * Terverifikasi di produksi: SNI domain asing membalas `CN=TRAEFIK DEFAULT
 * CERT` (self-signed). Karena itu status tidak boleh naik ke "active" sebelum
 * route domain terpasang.
 */

const db = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
}));

const k8s = vi.hoisted(() => ({
  checkCertificateReady: vi.fn(),
  deleteCertificate: vi.fn(),
  createCertificate: vi.fn(),
  upsertRoute: vi.fn(),
  deleteRoute: vi.fn(),
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    tenantDomain: {
      findUnique: db.findUnique,
      findMany: db.findMany,
      update: db.update,
      create: db.create,
      delete: db.delete,
    },
  },
}));

vi.mock("@/modules/tenant/services/K8sCertificateService", () => ({
  K8sCertificateService: class {
    checkCertificateReady = k8s.checkCertificateReady;
    deleteCertificate = k8s.deleteCertificate;
    createCertificate = k8s.createCertificate;
  },
}));

vi.mock("@/modules/tenant/services/K8sIngressRouteService", () => ({
  K8sIngressRouteService: class {
    upsertRoute = k8s.upsertRoute;
    deleteRoute = k8s.deleteRoute;
  },
}));

const { TenantDomainService } = await import("@/modules/tenant");

const provisioningRow = {
  id: "row-1",
  tenantId: "tenant-1",
  slug: "akses-cepat",
  domain: "portal.klien.com",
  status: "verified",
  sslStatus: "provisioning",
};

let service: InstanceType<typeof TenantDomainService>;

const updatedFields = () =>
  db.update.mock.calls.map(([args]) => (args as { data: unknown }).data);

beforeEach(() => {
  vi.clearAllMocks();
  db.findMany.mockResolvedValue([provisioningRow]);
  db.update.mockResolvedValue(provisioningRow);
  service = new TenantDomainService();
});

describe("checkSslProvisioning", () => {
  it("memasang route TLS begitu sertifikat siap", async () => {
    k8s.checkCertificateReady.mockResolvedValue(true);
    k8s.upsertRoute.mockResolvedValue(true);

    await service.checkSslProvisioning();

    expect(k8s.upsertRoute).toHaveBeenCalledWith({
      slug: "akses-cepat",
      domain: "portal.klien.com",
    });
    expect(updatedFields()).toContainEqual({ sslStatus: "active" });
    expect(updatedFields()).toContainEqual({ status: "active" });
  });

  // Inti regresi: mengumumkan domain aktif padahal route belum terpasang
  // membuat pengguna menerima sertifikat bawaan Traefik.
  it("tidak menaikkan status saat route gagal dipasang", async () => {
    k8s.checkCertificateReady.mockResolvedValue(true);
    k8s.upsertRoute.mockResolvedValue(false);

    await service.checkSslProvisioning();

    expect(db.update).not.toHaveBeenCalled();
  });

  it("tidak melakukan apa pun selama sertifikat belum siap", async () => {
    k8s.checkCertificateReady.mockResolvedValue(false);

    await service.checkSslProvisioning();

    expect(k8s.upsertRoute).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe("disableDomain", () => {
  it("melepas route sebelum menghapus sertifikat", async () => {
    db.findUnique.mockResolvedValue(provisioningRow);
    k8s.deleteRoute.mockResolvedValue(true);
    k8s.deleteCertificate.mockResolvedValue(true);

    await service.disableDomain("row-1");

    expect(k8s.deleteRoute).toHaveBeenCalledWith("akses-cepat");
    expect(k8s.deleteCertificate).toHaveBeenCalledWith("akses-cepat");
  });
});
