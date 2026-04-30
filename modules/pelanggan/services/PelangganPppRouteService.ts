import { prisma } from "@/modules/database";
import { RadiusSyncService } from "@/modules/network";
import { getPelangganService } from "./PelangganService";
import {
  DEFAULT_PAGE,
  MAX_LIMIT,
  buildSuspensionHistoryResponse,
  buildSuspensionWhere,
  buildUsageHistoryResponse,
  buildUsageSummaryResponse,
  createCandidateId,
  createFallbackId,
  mapRadiusHistoryItem,
  mapSuspensionSortBy,
  sortUsageHistory,
  type ParsedDateRange,
  type SuspensionHistoryInput,
  type UsageCustomerRecord,
  type UsageHistoryInput,
  type UsageSummaryInput,
  type UsageSource,
} from "./pelanggan-ppp-route-helpers";
import {
  BASIC_CUSTOMER_SELECT,
  findPelangganForLifecycle,
  findUsageCustomer,
  getDatabaseHistory,
  getDatabaseUsageStats,
  type UpdateCustomerStatusInput,
} from "./pelanggan-ppp-route-queries";
import {
  finalizeActivation,
  finalizeSuspension,
  persistCustomerActivation,
  persistCustomerSuspension,
  syncActivationRadius,
  syncSuspensionRadius,
} from "./pelanggan-ppp-lifecycle.helpers";
import {
  RouteServiceError,
  activateRequestSchema,
  ensureRouteTenantId,
  normalizeRoutePagination,
  parseRouteDateRange,
  parseRouteUsagePeriod,
  suspendRequestSchema,
} from "./pelanggan-ppp-route-validation";
export { RouteServiceError } from "./pelanggan-ppp-route-validation";
const DEFAULT_CREATE_LIMIT = 10;
export class PelangganPppRouteService {
  private readonly radiusService = new RadiusSyncService();
  /** Check whether a pelanggan code already exists. */
  async checkIdExists(idPelanggan: string) {
    try {
      const pelanggan = await prisma.pelanggan.findFirst({
        where: { idPelanggan },
        select: { id: true },
      });
      return { exists: pelanggan !== null };
    } catch {
      return { exists: false };
    }
  }
  /** Generate a unique pelanggan code. */
  async generateUniqueId() {
    let idPelanggan = createCandidateId();
    let attempts = 0;
    while (attempts < DEFAULT_CREATE_LIMIT) {
      const { exists } = await this.checkIdExists(idPelanggan);
      if (!exists) return { idPelanggan };
      idPelanggan = createCandidateId();
      attempts += 1;
    }
    return { idPelanggan: createFallbackId() };
  }
  /** Get one customer usage summary for admin route. */
  async getUsageSummary(input: UsageSummaryInput) {
    const pelanggan = await findUsageCustomer(input);
    if (!pelanggan) return null;
    const tenantId = ensureRouteTenantId(pelanggan.tenantId);
    const periodRange = parseRouteUsagePeriod(input);
    const radiusStats = await this.radiusService.getCustomerAccountingStats(
      pelanggan.username,
      tenantId,
      periodRange.startDate,
      periodRange.endDate,
    );
    const activeSession = await this.getFirstActiveSession(pelanggan);
    const dbStats = await getDatabaseUsageStats({
      pelangganId: pelanggan.id,
      startDate: periodRange.startDate,
      endDate: periodRange.endDate,
    });
    return buildUsageSummaryResponse({
      pelanggan,
      periodType: input.period,
      periodRange,
      radiusStats,
      activeSession,
      dbStats,
    });
  }
  /** Get combined customer usage history for admin route. */
  async getUsageHistory(input: UsageHistoryInput) {
    const pelanggan = await findUsageCustomer(input);
    if (!pelanggan) return null;
    const tenantId = ensureRouteTenantId(pelanggan.tenantId);
    const pagination = normalizeRoutePagination(input.page, input.limit);
    const dateRange = parseRouteDateRange(input.startDate, input.endDate);
    const radiusData = await this.getRadiusHistory(
      { ...pelanggan, tenantId },
      input.source,
      dateRange,
    );
    const databaseData = await getDatabaseHistory({
      pelangganId: pelanggan.id,
      source: input.source,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
      dateRange,
    });
    const combinedData = sortUsageHistory(
      [...radiusData, ...databaseData],
      input.sortBy,
      input.sortOrder,
    );
    return buildUsageHistoryResponse({
      pelanggan,
      pagination,
      source: input.source,
      dateRange,
      combinedData,
    });
  }
  /** Get customer suspension history and summary. */
  async getSuspensionHistory(input: SuspensionHistoryInput) {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: input.id },
      select: BASIC_CUSTOMER_SELECT,
    });
    if (!pelanggan) return null;
    const pagination = normalizeRoutePagination(input.page, input.limit);
    const dateRange = parseRouteDateRange(input.startDate, input.endDate);
    const where = buildSuspensionWhere({ ...input, dateRange });
    const [total, suspensions, allSuspensions, activeSuspensions] =
      await Promise.all([
        prisma.serviceSuspension.count({ where }),
        prisma.serviceSuspension.findMany({
          where,
          orderBy: { [mapSuspensionSortBy(input.sortBy)]: input.sortOrder },
          skip: (pagination.page - 1) * pagination.limit,
          take: pagination.limit,
        }),
        prisma.serviceSuspension.findMany({ where: { pelangganId: input.id } }),
        prisma.serviceSuspension.count({
          where: { pelangganId: input.id, is_active: true },
        }),
      ]);
    return buildSuspensionHistoryResponse({
      pelanggan,
      pagination,
      total,
      suspensions,
      allSuspensions,
      activeSuspensions,
      request: input,
      dateRange,
    });
  }
  /** Suspend one customer service and sync radius state. */
  async suspendCustomer(input: SuspendCustomerInput) {
    const payload = suspendRequestSchema.parse(input.body);
    const pelanggan = await this.requireLifecycleCustomer(input.id, "suspend");
    const result = await persistCustomerSuspension(pelanggan, {
      pelangganId: input.id,
      userId: input.userId,
      payload,
    });

    await syncSuspensionRadius(
      this.radiusService,
      pelanggan,
      payload.terminateActiveSessions,
    );

    return finalizeSuspension({
      pelangganId: input.id,
      userId: input.userId,
      payload,
      suspensionId: result.id,
    });
  }
  /** Update one customer status and return audit context. */
  async updateCustomerStatus(input: UpdateCustomerStatusInput) {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: input.id },
    });
    if (!pelanggan) throw new RouteServiceError("Pelanggan not found", 404);
    const updatedPelanggan = await getPelangganService().updateStatusPelanggan(
      input.id,
      input.status,
    );
    return {
      pelanggan,
      updatedPelanggan,
      message: `Status updated to ${input.status}`,
    };
  }
  /** Activate one suspended customer service and sync radius state. */
  async activateCustomer(input: ActivateCustomerInput) {
    const payload = activateRequestSchema.parse(input.body);
    const pelanggan = await this.requireLifecycleCustomer(input.id, "activate");

    try {
      const result = await persistCustomerActivation(pelanggan, {
        pelangganId: input.id,
        userId: input.userId,
        payload,
      });

      await syncActivationRadius(
        this.radiusService,
        input.id,
        payload.syncToRadius,
      );
      return finalizeActivation({
        pelangganId: input.id,
        userId: input.userId,
        payload,
        suspensionId: result.id,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "No active suspension found for this customer"
      ) {
        throw new RouteServiceError(error.message, 400);
      }
      throw error;
    }
  }

  /** Require customer record for PPP lifecycle action. */
  private async requireLifecycleCustomer(
    id: string,
    action: "activate" | "suspend",
  ) {
    const pelanggan = await findPelangganForLifecycle(id);
    if (!pelanggan) {
      throw new RouteServiceError("Customer not found", 404);
    }

    if (action === "suspend" && pelanggan.status === "NONAKTIF") {
      throw new RouteServiceError("Customer is already suspended", 400);
    }

    if (action === "activate" && pelanggan.status !== "NONAKTIF") {
      throw new RouteServiceError("Customer is not currently suspended", 400);
    }

    return pelanggan;
  }

  private async getFirstActiveSession(pelanggan: UsageCustomerRecord) {
    const activeSessions = await this.radiusService.getCustomerActiveSessions(
      pelanggan.username,
      pelanggan.tenantId,
    );
    return activeSessions[0] ?? null;
  }

  private async getRadiusHistory(
    pelanggan: UsageCustomerRecord,
    source: UsageSource,
    dateRange: ParsedDateRange,
  ) {
    if (source === "database") return [];
    const radiusSessions = await this.radiusService.getCustomerSessionHistory(
      pelanggan.username,
      pelanggan.tenantId,
      {
        page: DEFAULT_PAGE,
        limit: MAX_LIMIT,
        ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
        ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
      },
    );
    return radiusSessions.sessions.map(mapRadiusHistoryItem);
  }
}

type SuspendCustomerInput = {
  id: string;
  userId: string;
  body: unknown;
};
type ActivateCustomerInput = {
  id: string;
  userId: string;
  body: unknown;
};
