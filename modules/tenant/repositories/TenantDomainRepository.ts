import { prisma } from "@/modules/database";

/** Repository for TenantDomain data access. All Prisma queries for tenant domains go here. */
export class TenantDomainRepository {
  /** Find a tenant domain record by its unique slug. */
  async findBySlug(slug: string) {
    return prisma.tenantDomain.findUnique({ where: { slug } });
  }

  /** Find a tenant domain record by its custom domain. */
  async findByDomain(domain: string) {
    return prisma.tenantDomain.findUnique({ where: { domain } });
  }

  /** Find a tenant domain record by tenantId. */
  async findByTenantId(tenantId: string) {
    return prisma.tenantDomain.findUnique({ where: { tenantId } });
  }

  /** Find all tenant domains with status "pending" that have a custom domain set. */
  async findPendingDomains() {
    return prisma.tenantDomain.findMany({
      where: { status: "pending", domain: { not: null } },
      include: { tenant: { select: { name: true } } },
    });
  }

  /** Find all tenant domains with status "active" that have a custom domain set. */
  async findActiveDomains() {
    return prisma.tenantDomain.findMany({
      where: { status: "active", domain: { not: null } },
    });
  }

  /** Find all tenant domain records ordered by creation date descending. */
  async findAll() {
    return prisma.tenantDomain.findMany({
      include: { tenant: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Create a new tenant domain record. */
  async create(data: { tenantId: string; slug: string; domain?: string }) {
    return prisma.tenantDomain.create({ data });
  }

  /** Update the domain verification status, optionally setting verifiedAt timestamp. */
  async updateStatus(id: string, status: string, verifiedAt?: Date) {
    return prisma.tenantDomain.update({
      where: { id },
      data: { status, ...(verifiedAt && { verifiedAt }) },
    });
  }

  /** Update the SSL provisioning status for a tenant domain. */
  async updateSslStatus(id: string, sslStatus: string) {
    return prisma.tenantDomain.update({ where: { id }, data: { sslStatus } });
  }

  /** Set a new custom domain and reset verification/SSL status to pending. */
  async updateDomain(id: string, domain: string) {
    return prisma.tenantDomain.update({
      where: { id },
      data: {
        domain,
        status: "pending",
        sslStatus: "pending",
        verifiedAt: null,
      },
    });
  }

  /** Remove the custom domain and reset verification/SSL status to pending. */
  async removeDomain(id: string) {
    return prisma.tenantDomain.update({
      where: { id },
      data: {
        domain: null,
        status: "pending",
        sslStatus: "pending",
        verifiedAt: null,
      },
    });
  }

  /** Delete a tenant domain record permanently. */
  async delete(id: string) {
    return prisma.tenantDomain.delete({ where: { id } });
  }
}
