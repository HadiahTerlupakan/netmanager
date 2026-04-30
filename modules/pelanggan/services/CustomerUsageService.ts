import type { ICustomerUsageRepository } from "../domain/ports/ICustomerUsageRepository";
import { CustomerUsageRepository } from "../repositories/CustomerUsageRepository";
import {
  calculateSessionDuration,
  formatBytesValue,
  formatDurationValue,
  getStartOfCurrentMonth,
  sumUsageOctets,
} from "./customer-usage.helpers";

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

  /** Get technical connection metadata for admin PPP detail view. */
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
   * Get customer connection status and usage data.
   */
  async getUsageData(customerId: string) {
    const customer = await this.getRequiredCustomer(customerId);
    const latestSession = await this.repository.getLatestSession(
      customer.username,
    );
    const isOnline = Boolean(latestSession && !latestSession.acctstoptime);
    const sessionDuration = isOnline
      ? calculateSessionDuration(latestSession?.acctstarttime)
      : 0;
    const startOfMonth = getStartOfCurrentMonth();
    const [monthlyUsage, totalUsage] = await Promise.all([
      this.repository.getMonthlyUsage(customer.username, startOfMonth),
      this.repository.getTotalUsage(customer.username),
    ]);

    return {
      connection: this.buildConnectionData({
        latestSession,
        isOnline,
        sessionDuration,
      }),
      usage: this.buildUsageData({
        monthlyUsage,
        totalUsage,
        startOfMonth,
      }),
    };
  }

  /** Get required customer username for usage lookup. */
  private async getRequiredCustomer(customerId: string) {
    const customer = await this.repository.getCustomerUsername(customerId);
    if (!customer) {
      throw new Error("Data pelanggan tidak ditemukan");
    }
    return customer;
  }

  /** Build connection payload for customer usage response. */
  private buildConnectionData(input: {
    latestSession: Awaited<
      ReturnType<ICustomerUsageRepository["getLatestSession"]>
    >;
    isOnline: boolean;
    sessionDuration: number;
  }) {
    return {
      isOnline: input.isOnline,
      ipAddress: input.isOnline ? input.latestSession?.framedipaddress : null,
      nasipaddress: input.isOnline ? input.latestSession?.nasipaddress : null,
      sessionId: input.isOnline ? input.latestSession?.acctsessionid : null,
      sessionStart: input.isOnline ? input.latestSession?.acctstarttime : null,
      sessionDuration: input.isOnline ? input.sessionDuration : 0,
      sessionDurationFormatted: input.isOnline
        ? formatDurationValue(input.sessionDuration)
        : null,
      lastSeen:
        input.latestSession?.acctstoptime ||
        input.latestSession?.acctupdatetime ||
        null,
    };
  }

  /** Build usage totals for customer usage response. */
  private buildUsageData(input: {
    monthlyUsage: Awaited<
      ReturnType<ICustomerUsageRepository["getMonthlyUsage"]>
    >;
    totalUsage: Awaited<ReturnType<ICustomerUsageRepository["getTotalUsage"]>>;
    startOfMonth: Date;
  }) {
    return {
      monthly: {
        download: formatBytesValue(input.monthlyUsage._sum.acctinputoctets),
        upload: formatBytesValue(input.monthlyUsage._sum.acctoutputoctets),
        total: formatBytesValue(
          sumUsageOctets(
            input.monthlyUsage._sum.acctinputoctets,
            input.monthlyUsage._sum.acctoutputoctets,
          ),
        ),
        period: { start: input.startOfMonth, end: new Date() },
      },
      allTime: {
        download: formatBytesValue(input.totalUsage._sum.acctinputoctets),
        upload: formatBytesValue(input.totalUsage._sum.acctoutputoctets),
        total: formatBytesValue(
          sumUsageOctets(
            input.totalUsage._sum.acctinputoctets,
            input.totalUsage._sum.acctoutputoctets,
          ),
        ),
      },
    };
  }
}
