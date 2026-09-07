import { prisma } from "@/modules/database";
import { TenantDomainRepository } from "../repositories/TenantDomainRepository";
import { DnsVerificationService } from "./DnsVerificationService";
import { K8sCertificateService } from "./K8sCertificateService";
import { K8sIngressRouteService } from "./K8sIngressRouteService";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import {
  buildSlugCandidate,
  buildSlugVariant,
  isReservedSlug,
} from "./tenant-slug";

const MAX_SLUG_ATTEMPTS = 50;

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, "");
}

/**
 * Domain kustom harus benar-benar milik tenant, bukan host kita sendiri.
 *
 * Menerima `sesuatu.radpro.id` sebagai "domain kustom" akan bertabrakan dengan
 * subdomain slug dan portal: resolusi tenant membaca host yang sama, dan
 * sertifikatnya sudah ditangani sertifikat utama.
 */
function assertDomainIsExternal(domain: string) {
  const baseDomain = (process.env.DOMAIN || "radpro.id").toLowerCase();

  if (domain === baseDomain || domain.endsWith(`.${baseDomain}`)) {
    throw new AppError(
      `Domain kustom tidak boleh berada di bawah ${baseDomain}`,
      422,
      "DOMAIN_NOT_EXTERNAL",
    );
  }
}

export class TenantDomainService {
  private repository: TenantDomainRepository;
  private dnsService: DnsVerificationService;
  private k8sService: K8sCertificateService;
  private routeService: K8sIngressRouteService;

  constructor() {
    this.repository = new TenantDomainRepository();
    this.dnsService = new DnsVerificationService();
    this.k8sService = new K8sCertificateService();
    this.routeService = new K8sIngressRouteService();
  }

  /** Resolve a tenant domain record by slug. */
  async resolveBySlug(slug: string) {
    return this.repository.findBySlug(slug);
  }

  /** Resolve a tenant domain record by custom domain. */
  async resolveByDomain(domain: string) {
    return this.repository.findByDomain(domain);
  }

  /** Get the tenant domain record for a given tenantId. */
  async getByTenantId(tenantId: string) {
    return this.repository.findByTenantId(tenantId);
  }

  /** List all tenant domain records. */
  async listAll() {
    return this.repository.findAll();
  }

  /** Create a new tenant domain record for a tenant. */
  async createForTenant(tenantId: string, slug: string, domain?: string) {
    const normalizedSlug = slug.toLowerCase();
    await this.assertSlugUsable(normalizedSlug);

    return this.repository.create({ tenantId, slug: normalizedSlug, domain });
  }

  /**
   * Pastikan tenant punya baris domain, buat bila belum ada.
   *
   * Tanpa baris ini tenant tidak punya subdomain slug maupun jalur domain
   * kustom: seluruh alur verifikasi dan SSL membaca tabel yang sama. Dibuat
   * idempoten supaya aman dipanggil dari pembuatan tenant maupun backfill.
   */
  async ensureForTenant(tenantId: string, tenantName: string) {
    const existing = await this.repository.findByTenantId(tenantId);
    if (existing) return existing;

    const slug = await this.reserveAvailableSlug(tenantName);

    return this.repository.create({ tenantId, slug });
  }

  /** Set or update the custom domain for a tenant domain record. */
  async setCustomDomain(id: string, domain: string) {
    const normalizedDomain = normalizeDomain(domain);
    assertDomainIsExternal(normalizedDomain);
    await this.assertDomainUnused(id, normalizedDomain);

    return this.repository.updateDomain(id, normalizedDomain);
  }

  /** Remove the custom domain from a tenant domain record. */
  async removeCustomDomain(id: string) {
    return this.repository.removeDomain(id);
  }

  /**
   * Poll all pending domains, verify their CNAME, and trigger SSL provisioning
   * for any that pass. Returns a result list for each domain checked.
   */
  async verifyPendingDomains() {
    const pending = await this.repository.findPendingDomains();
    const results: Array<{ domain: string; verified: boolean }> = [];

    for (const record of pending) {
      if (!record.domain) continue;
      const verified = await this.dnsService.verifyPointsToUs(record.domain);
      if (verified) {
        await this.repository.updateStatus(record.id, "verified", new Date());
        await this.provisionSsl(record.id, record.slug, record.domain);
      }
      results.push({ domain: record.domain, verified });
    }

    return results;
  }

  /**
   * Check all active domains still resolve. Marks any that no longer resolve
   * as failed and resets their SSL status.
   */
  async checkActiveDomains() {
    const active = await this.repository.findActiveDomains();
    const results: Array<{ domain: string; stillActive: boolean }> = [];

    for (const record of active) {
      if (!record.domain) continue;
      const resolves = await this.dnsService.resolvesDomain(record.domain);
      if (!resolves) {
        await this.repository.updateStatus(record.id, "failed");
        await this.repository.updateSslStatus(record.id, "failed");
      }
      results.push({ domain: record.domain, stillActive: resolves });
    }

    return results;
  }

  /**
   * Check all domains with sslStatus="provisioning" and promote them to
   * active once the cert-manager Certificate reaches Ready=True.
   */
  async checkSslProvisioning() {
    const provisioning = await prisma.tenantDomain.findMany({
      where: { sslStatus: "provisioning" },
    });

    for (const record of provisioning) {
      const ready = await this.k8sService.checkCertificateReady(record.slug);
      if (!ready || !record.domain) continue;

      // Sertifikat yang terbit hanya tersimpan sebagai Secret. Traefik baru
      // menyajikannya setelah ada route yang merujuk Secret itu, jadi status
      // tidak boleh naik ke "active" sebelum route terpasang — kalau tidak,
      // domain diumumkan aktif padahal browser masih menerima sertifikat
      // bawaan Traefik.
      const routed = await this.routeService.upsertRoute({
        slug: record.slug,
        domain: record.domain,
      });

      if (!routed) {
        logger.error(
          `[TenantDomain] Sertifikat siap tetapi route gagal dipasang untuk ${record.domain}`,
        );
        continue;
      }

      await this.repository.updateSslStatus(record.id, "active");
      await this.repository.updateStatus(record.id, "active");
      logger.info(`[TenantDomain] SSL active for ${record.domain}`);
    }
  }

  /**
   * Disable a tenant's custom domain: delete the K8s certificate, then mark
   * both domain status and SSL status as failed.
   */
  async disableDomain(id: string) {
    // Rute pemanggil (`/api/admin/tenant-domains/[id]/disable`) mengirim id
    // baris, bukan tenantId. Pencarian lewat `findByTenantId` selalu meleset
    // sehingga tombol nonaktifkan diam-diam tidak melakukan apa pun.
    const record = await this.repository.findById(id);
    if (record) {
      await this.routeService.deleteRoute(record.slug);
      await this.k8sService.deleteCertificate(record.slug);
      await this.repository.updateStatus(record.id, "failed");
      await this.repository.updateSslStatus(record.id, "failed");
    }
  }

  /**
   * Manually trigger CNAME verification for a specific domain record.
   * Provisions SSL immediately if verification passes.
   */
  async manualVerify(id: string) {
    const record = await prisma.tenantDomain.findUnique({ where: { id } });
    if (!record?.domain) return { verified: false, reason: "No domain set" };

    const verified = await this.dnsService.verifyPointsToUs(record.domain);
    if (verified) {
      await this.repository.updateStatus(id, "verified", new Date());
      await this.provisionSsl(id, record.slug, record.domain);
      return { verified: true };
    }
    const baseDomain = process.env.DOMAIN || "radpro.id";
    return {
      verified: false,
      reason: `DNS belum mengarah ke ${baseDomain}: pasang CNAME ke ${baseDomain}, atau A record ke IP yang sama dengan ${baseDomain} bila domainnya apex`,
    };
  }

  /**
   * Cari slug bebas untuk sebuah nama tenant.
   *
   * Tabrakan diselesaikan dengan pembeda angka; batas percobaan mencegah
   * pencarian tak berujung saat ada anomali data.
   */
  private async reserveAvailableSlug(tenantName: string): Promise<string> {
    const candidate = buildSlugCandidate(tenantName);

    for (let attempt = 0; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
      const slug =
        attempt === 0 ? candidate : buildSlugVariant(candidate, attempt);

      if (isReservedSlug(slug)) continue;
      if (!(await this.repository.findBySlug(slug))) return slug;
    }

    throw new AppError(
      "Tidak menemukan slug yang tersedia untuk tenant ini",
      409,
      "SLUG_UNAVAILABLE",
    );
  }

  /** Tolak slug yang dipesan portal atau sudah dipakai tenant lain. */
  private async assertSlugUsable(slug: string) {
    if (isReservedSlug(slug)) {
      throw new AppError(
        `Slug "${slug}" dipesan untuk portal dan tidak bisa dipakai tenant`,
        409,
        "SLUG_RESERVED",
      );
    }

    if (await this.repository.findBySlug(slug)) {
      throw new AppError(
        `Slug "${slug}" sudah dipakai tenant lain`,
        409,
        "SLUG_TAKEN",
      );
    }
  }

  /** Tolak domain yang sudah dipakai baris lain. */
  private async assertDomainUnused(id: string, domain: string) {
    const existing = await this.repository.findByDomain(domain);
    if (existing && existing.id !== id) {
      throw new AppError(
        `Domain "${domain}" sudah dipakai tenant lain`,
        409,
        "DOMAIN_TAKEN",
      );
    }
  }

  /** Trigger K8s certificate creation and update sslStatus accordingly. */
  private async provisionSsl(id: string, slug: string, domain: string) {
    const success = await this.k8sService.createCertificate({ slug, domain });
    if (success) {
      await this.repository.updateSslStatus(id, "provisioning");
    } else {
      await this.repository.updateSslStatus(id, "failed");
    }
  }
}
