import { RadiusSyncService } from "@/modules/network";

import { getPelangganService } from "./PelangganService";
import {
  buildFallbackPelangganIdResponse,
  buildPelangganIdCandidates,
} from "./pelanggan-ppp-route-id.helpers";
import {
  buildSuspensionHistoryResponse,
  buildUsageHistoryResponse,
  buildUsageSummaryResponse,
  sortUsageHistory,
  type SuspensionHistoryInput,
  type UsageHistoryInput,
  type UsageSummaryInput,
} from "./pelanggan-ppp-route-helpers";
import {
  getFirstActiveSession,
  getRadiusHistory,
  requireLifecycleCustomer,
} from "./pelanggan-ppp-route-service.helpers";
import {
  checkPelangganCodeExists,
  findUsageCustomer,
  getDatabaseHistory,
  getDatabaseUsageStats,
  getSuspensionHistoryData,
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
  assertRouteSiteAccess,
  ensureRouteTenantId,
  normalizeRoutePagination,
  parseRouteDateRange,
  parseRouteUsagePeriod,
  resolveRouteTenantScope,
  suspendRequestSchema,
} from "./pelanggan-ppp-route-validation";
import type { AdminMutationSession } from "./PelangganAdminMutationService";
export { RouteServiceError } from "./pelanggan-ppp-route-validation";

export class PelangganPppRouteService {
  private readonly radiusService = new RadiusSyncService();

  /** Check whether a pelanggan code already exists. */
  async checkIdExists(idPelanggan: string) {
    return checkPelangganCodeExists({ idPelanggan });
  }

  /** Generate a unique pelanggan code. */
  async generateUniqueId() {
    const candidates = buildPelangganIdCandidates();

    for (const idPelanggan of candidates) {
      const { exists } = await this.checkIdExists(idPelanggan);
      if (!exists) {
        return { idPelanggan };
      }
    }

    return buildFallbackPelangganIdResponse();
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
    const activeSession = await getFirstActiveSession(
      this.radiusService,
      pelanggan,
    );
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
    const radiusData = await getRadiusHistory(
      this.radiusService,
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
  async getSuspensionHistory(
    input: SuspensionHistoryInput & { session: AdminMutationSession },
  ) {
    const tenantId = resolveRouteTenantScope(input.session, input.id);
    const pagination = normalizeRoutePagination(input.page, input.limit);
    const dateRange = parseRouteDateRange(input.startDate, input.endDate);
    const history = await getSuspensionHistoryData({
      id: input.id,
      tenantId,
      suspensionType: input.suspensionType,
      status: input.status,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
      page: pagination.page,
      limit: pagination.limit,
      dateRange,
    });

    if (!history.pelanggan) return null;

    return buildSuspensionHistoryResponse({
      pelanggan: history.pelanggan,
      pagination,
      total: history.total,
      suspensions: history.suspensions,
      allSuspensions: history.allSuspensions,
      activeSuspensions: history.activeSuspensions,
      request: input,
      dateRange,
    });
  }

  /** Suspend one customer service and sync radius state. */
  async suspendCustomer(input: SuspendCustomerInput) {
    const payload = suspendRequestSchema.parse(input.body);
    const pelanggan = await requireLifecycleCustomer(
      input.id,
      "suspend",
      resolveRouteTenantScope(input.session, input.id),
    );
    assertRouteSiteAccess(input.session, pelanggan.siteId);
    const suspension = await persistCustomerSuspension(pelanggan, {
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
      suspension,
    });
  }

  /**
   * Update one customer status within the session's tenant and return audit
   * context. A customer of another tenant answers 404 like a missing id, so
   * ids cannot be probed across tenants.
   */
  async updateCustomerStatus(input: UpdateCustomerStatusInput) {
    const tenantId = resolveRouteTenantScope(input.session, input.id);
    const pelanggan = await findUsageCustomer({ id: input.id, tenantId });
    if (!pelanggan) throw new RouteServiceError("Pelanggan not found", 404);
    assertRouteSiteAccess(input.session, pelanggan.siteId);

    const updatedPelanggan = await getPelangganService().updateStatusPelanggan(
      input.id,
      input.status,
      tenantId,
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
    const pelanggan = await requireLifecycleCustomer(
      input.id,
      "activate",
      resolveRouteTenantScope(input.session, input.id),
    );
    assertRouteSiteAccess(input.session, pelanggan.siteId);

    try {
      const suspension = await persistCustomerActivation(pelanggan, {
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
        suspension,
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
}

type SuspendCustomerInput = {
  id: string;
  userId: string;
  body: unknown;
  session: AdminMutationSession;
};

type ActivateCustomerInput = {
  id: string;
  userId: string;
  body: unknown;
  session: AdminMutationSession;
};
