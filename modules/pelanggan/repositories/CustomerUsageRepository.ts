import { prisma } from "@/lib/prisma";
import { prismaRadius } from "@/lib/prisma-radius";
import type { Prisma } from "@prisma/client-radius";
import type { ICustomerUsageRepository } from "../domain/ports/ICustomerUsageRepository";

/**
 * Repository for customer usage and RADIUS data access.
 */
export class CustomerUsageRepository implements ICustomerUsageRepository {
  /** Get customer username for RADIUS lookup. */
  async getCustomerUsername(customerId: string) {
    return prisma.pelanggan.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        username: true,
        status: true,
      },
    });
  }

  /** Get static IP reply for username. */
  async getStaticIpReply(username: string, tenantId?: string | null) {
    return prismaRadius.radreply.findFirst({
      where: this.buildStaticIpWhere(username, tenantId),
      orderBy: { id: "desc" },
      select: { value: true },
    });
  }

  /** Get latest session for technical information. */
  async getLatestSessionForTechnicalInfo(
    username: string,
    tenantId?: string | null,
  ) {
    return prismaRadius.radacct.findFirst({
      where: this.buildRadiusTenantWhere(username, tenantId),
      orderBy: [{ acctupdatetime: "desc" }, { acctstarttime: "desc" }],
      select: {
        framedipaddress: true,
        nasipaddress: true,
      },
    });
  }

  /** Get router name by NAS IP. */
  async getRouterNameByNasIp(nasIpAddress: string, tenantId?: string | null) {
    return prisma.mikroTikRouter.findFirst({
      where: this.buildRouterWhere(nasIpAddress, tenantId),
      select: { name: true },
    });
  }

  /** Get latest RADIUS session for username. */
  async getLatestSession(username: string) {
    return prismaRadius.radacct.findFirst({
      where: { username },
      orderBy: { acctstarttime: "desc" },
    });
  }

  /** Get monthly usage aggregate. */
  async getMonthlyUsage(username: string, startOfMonth: Date) {
    return prismaRadius.radacct.aggregate({
      where: {
        username,
        acctstarttime: { gte: startOfMonth },
      },
      _sum: {
        acctinputoctets: true,
        acctoutputoctets: true,
      },
    });
  }

  /** Get total usage aggregate. */
  async getTotalUsage(username: string) {
    return prismaRadius.radacct.aggregate({
      where: { username },
      _sum: {
        acctinputoctets: true,
        acctoutputoctets: true,
      },
    });
  }

  private buildStaticIpWhere(
    username: string,
    tenantId?: string | null,
  ): Prisma.radreplyWhereInput {
    if (!tenantId) {
      return {
        username,
        attribute: "Framed-IP-Address",
        tenantId: null,
      };
    }

    return {
      username,
      attribute: "Framed-IP-Address",
      OR: [{ tenantId }, { tenantId: null }],
    };
  }

  private buildRadiusTenantWhere(
    username: string,
    tenantId?: string | null,
  ): Prisma.radacctWhereInput {
    if (!tenantId) {
      return { username, tenantId: null };
    }

    return {
      username,
      OR: [{ tenantId }, { tenantId: null }],
    };
  }

  private buildRouterWhere(nasIpAddress: string, tenantId?: string | null) {
    if (!tenantId) {
      return { ipAddress: nasIpAddress };
    }

    return {
      ipAddress: nasIpAddress,
      OR: [{ tenantId }, { tenantId: null }],
    };
  }
}
