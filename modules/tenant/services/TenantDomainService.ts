import { prisma } from "@/modules/database";
import { TenantDomainRepository } from "../repositories/TenantDomainRepository";
import { DnsVerificationService } from "./DnsVerificationService";
import { K8sCertificateService } from "./K8sCertificateService";
import { logger } from "@/lib/logger";

export class TenantDomainService {
  private repository: TenantDomainRepository;
  private dnsService: DnsVerificationService;
  private k8sService: K8sCertificateService;

  constructor() {
    this.repository = new TenantDomainRepository();
    this.dnsService = new DnsVerificationService();
    this.k8sService = new K8sCertificateService();
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
    return this.repository.create({ tenantId, slug, domain });
  }

  /** Set or update the custom domain for a tenant domain record. */
  async setCustomDomain(id: string, domain: string) {
    return this.repository.updateDomain(id, domain);
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
      const verified = await this.dnsService.verifyCname(record.domain);
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
      if (ready) {
        await this.repository.updateSslStatus(record.id, "active");
        await this.repository.updateStatus(record.id, "active");
        logger.info(`[TenantDomain] SSL active for ${record.domain}`);
      }
    }
  }

  /**
   * Disable a tenant's custom domain: delete the K8s certificate, then mark
   * both domain status and SSL status as failed.
   */
  async disableDomain(id: string) {
    const record = await this.repository.findByTenantId(id);
    if (record) {
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

    const verified = await this.dnsService.verifyCname(record.domain);
    if (verified) {
      await this.repository.updateStatus(id, "verified", new Date());
      await this.provisionSsl(id, record.slug, record.domain);
      return { verified: true };
    }
    return { verified: false, reason: "CNAME not pointing to radpro.id" };
  }

  /** Trigger K8s certificate creation and update sslStatus accordingly. */
  private async provisionSsl(id: string, slug: string, domain: string) {
    const namespace = process.env.K8S_NAMESPACE || "netmanager-production";
    const success = await this.k8sService.createCertificate({
      slug,
      domain,
      namespace,
    });
    if (success) {
      await this.repository.updateSslStatus(id, "provisioning");
    } else {
      await this.repository.updateSslStatus(id, "failed");
    }
  }
}
