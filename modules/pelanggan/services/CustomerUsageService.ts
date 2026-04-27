import { toStartOfDay } from "@/lib/utils/server-datetime";
import type { ICustomerUsageRepository } from "../domain/ports/ICustomerUsageRepository";
import { CustomerUsageRepository } from "../repositories/CustomerUsageRepository";

/**
 * Service for customer usage/connection status
 */
export class CustomerUsageService {
  private repository: ICustomerUsageRepository;

  constructor(
    repository: ICustomerUsageRepository = new CustomerUsageRepository(),
  ) {
    this.repository = repository;
  }

  async getTechnicalInfo(input: {
    username: string;
    tenantId?: string | null;
    packageRouterName?: string | null;
    odpName?: string | null;
    odpLocation?: string | null;
  }) {
    const [staticIpReply, latestRadiusSession] = await Promise.all([
      this.repository.getStaticIpReply(input.username, input.tenantId),
      this.repository.getLatestSessionForTechnicalInfo(
        input.username,
        input.tenantId,
      ),
    ]);

    const routerByNas = latestRadiusSession?.nasipaddress
      ? await this.repository.getRouterNameByNasIp(
          latestRadiusSession.nasipaddress,
          input.tenantId,
        )
      : null;

    const staticIpAddress =
      staticIpReply?.value || latestRadiusSession?.framedipaddress || null;
    const staticIpSource = staticIpReply?.value
      ? "radreply · Framed-IP-Address"
      : latestRadiusSession?.framedipaddress
        ? "radacct · sesi terakhir"
        : null;

    const serverRouterName =
      input.packageRouterName ||
      routerByNas?.name ||
      latestRadiusSession?.nasipaddress ||
      null;
    const serverRouterSource = input.packageRouterName
      ? "Profile PPP · MikroTik Router"
      : routerByNas?.name
        ? "NAS IP · MikroTik Router"
        : latestRadiusSession?.nasipaddress
          ? "radacct · NAS IP"
          : null;

    const odpPortValue = input.odpLocation
      ? `${input.odpName} · ${input.odpLocation}`
      : input.odpName || null;
    const odpPortSource = input.odpName ? "Relasi pelanggan · ODP" : null;

    return {
      staticIpAddress,
      staticIpSource,
      serverRouterName,
      serverRouterSource,
      odpPortValue,
      odpPortSource,
    };
  }

  /**
   * Get customer connection status and usage data
   */
  async getUsageData(customerId: string) {
    // Get customer username
    const customer = await this.repository.getCustomerUsername(customerId);
    if (!customer) {
      throw new Error("Data pelanggan tidak ditemukan");
    }

    // Get latest session
    const latestSession = await this.repository.getLatestSession(
      customer.username,
    );

    // Check if online
    const isOnline = latestSession && !latestSession.acctstoptime;

    // Calculate session duration if online
    let sessionDuration = 0;
    if (isOnline && latestSession.acctstarttime) {
      sessionDuration = Math.floor(
        (Date.now() - new Date(latestSession.acctstarttime).getTime()) / 1000,
      );
    }

    // Get monthly usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setTime(toStartOfDay(startOfMonth).getTime());

    const [monthlyUsage, totalUsage] = await Promise.all([
      this.repository.getMonthlyUsage(customer.username, startOfMonth),
      this.repository.getTotalUsage(customer.username),
    ]);

    return {
      connection: {
        isOnline,
        ipAddress: isOnline ? latestSession.framedipaddress : null,
        nasipaddress: isOnline ? latestSession.nasipaddress : null,
        sessionId: isOnline ? latestSession.acctsessionid : null,
        sessionStart: isOnline ? latestSession.acctstarttime : null,
        sessionDuration: isOnline ? sessionDuration : 0,
        sessionDurationFormatted: isOnline
          ? this.formatDuration(sessionDuration)
          : null,
        lastSeen:
          latestSession?.acctstoptime || latestSession?.acctupdatetime || null,
      },
      usage: {
        monthly: {
          download: this.formatBytes(monthlyUsage._sum.acctinputoctets),
          upload: this.formatBytes(monthlyUsage._sum.acctoutputoctets),
          total: this.formatBytes(
            (monthlyUsage._sum.acctinputoctets || BigInt(0)) +
              (monthlyUsage._sum.acctoutputoctets || BigInt(0)),
          ),
          period: {
            start: startOfMonth,
            end: new Date(),
          },
        },
        allTime: {
          download: this.formatBytes(totalUsage._sum.acctinputoctets),
          upload: this.formatBytes(totalUsage._sum.acctoutputoctets),
          total: this.formatBytes(
            (totalUsage._sum.acctinputoctets || BigInt(0)) +
              (totalUsage._sum.acctoutputoctets || BigInt(0)),
          ),
        },
      },
    };
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: bigint | null) {
    if (!bytes) return { bytes: 0, formatted: "0 B" };
    const numBytes = Number(bytes);
    if (numBytes === 0) return { bytes: 0, formatted: "0 B" };

    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(numBytes) / Math.log(1024));
    const formatted =
      parseFloat((numBytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];

    return { bytes: numBytes, formatted };
  }

  /**
   * Format duration to human readable
   */
  private formatDuration(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}j ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}d`;
    }
    return `${secs}d`;
  }
}
