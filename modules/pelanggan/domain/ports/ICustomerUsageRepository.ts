/**
 * Abstraction for customer usage repository operations.
 */

import type {
  CustomerRadiusSessionEntity,
  CustomerRadiusTechnicalSessionEntity,
  CustomerRouterEntity,
  CustomerStaticIpEntity,
  CustomerUsageAggregateEntity,
  CustomerUsageCustomerEntity,
} from "../entities/CustomerUsageEntity";

export interface ICustomerUsageRepository {
  /** Get customer username for usage lookup. */
  getCustomerUsername(
    customerId: string,
  ): Promise<CustomerUsageCustomerEntity | null>;

  /** Get static IP reply for username. */
  getStaticIpReply(
    username: string,
    tenantId?: string | null,
  ): Promise<CustomerStaticIpEntity | null>;

  /** Get latest technical session for username. */
  getLatestSessionForTechnicalInfo(
    username: string,
    tenantId?: string | null,
  ): Promise<CustomerRadiusTechnicalSessionEntity | null>;

  /** Get router name by NAS IP. */
  getRouterNameByNasIp(
    nasIpAddress: string,
    tenantId?: string | null,
  ): Promise<CustomerRouterEntity | null>;

  /** Get latest session for username. */
  getLatestSession(
    username: string,
  ): Promise<CustomerRadiusSessionEntity | null>;

  /** Get monthly usage aggregate. */
  getMonthlyUsage(
    username: string,
    startOfMonth: Date,
  ): Promise<CustomerUsageAggregateEntity>;

  /** Get total usage aggregate. */
  getTotalUsage(username: string): Promise<CustomerUsageAggregateEntity>;
}
