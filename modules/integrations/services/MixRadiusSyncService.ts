import type { IMixRadiusDataRepository } from "../domain/ports/IMixRadiusDataRepository";
import { createMixRadiusDataRepository } from "../factories/MixRadiusRepositoryFactory";
import { getMixRadiusService } from "./MixRadiusService";
import {
  assignNplBucket,
  buildCustomerPayload,
  buildCustomerPayloadFromInvoice,
  buildOwnerFilter,
  buildPlanAverageMap,
  calculateExpiredDays,
  createNplStats,
  getDefaultGlobalAverage,
  getMixRadiusSyncErrorMessage,
  getYesterdaySettlementDate,
  isCustomerIncludedByOwner,
  isMixRadiusConfigError,
  isNplCustomer,
  normalizeInvoiceStatus,
  parseAmount,
  resolveEstimatedAmount,
  resolveSyncDateRange,
  resolveTenantId,
} from "./mixradius-sync-helpers";
import { parseMixRadiusDate } from "./mixradius-date-utils";
import type {
  MixRadiusCustomerDetail,
  MixRadiusIncomePeriodRecord,
} from "./mixradius-types";

export class MixRadiusSyncService {
  constructor(
    private readonly repo: IMixRadiusDataRepository = createMixRadiusDataRepository(),
  ) {}

  /** Sync a single customer into local storage. */
  async syncCustomer(data: MixRadiusCustomerDetail, tenantId?: string) {
    if (!data.username) {
      throw new Error("Username diperlukan untuk sinkronisasi");
    }

    const customer = await this.repo.upsertMixRadiusCustomer(
      buildCustomerPayload(data, tenantId),
    );
    const linked = await this.linkCustomerToPelanggan(data);

    return { action: "synced", customer, linked };
  }

  /** Sync all MixRadius customers into local storage. */
  async syncAllCustomers() {
    try {
      const service = getMixRadiusService();
      const response = await service.fetchCustomersPPP({ length: 10000 });
      const customers = Array.isArray(response.data) ? response.data : [];

      if (customers.length === 0) {
        return { success: true, count: 0 };
      }

      let count = 0;
      for (const customer of customers) {
        await this.repo.upsertMixRadiusCustomer(
          buildCustomerPayload(customer, undefined),
        );
        count += 1;
      }

      return { success: true, count };
    } catch (error: unknown) {
      if (isMixRadiusConfigError(error)) {
        return {
          success: false,
          count: 0,
          reason: getMixRadiusSyncErrorMessage(error),
        };
      }

      throw error;
    }
  }

  /** Sync settlement data for yesterday. */
  async syncYesterdaySettlement() {
    const settlementDate = getYesterdaySettlementDate();
    return this.syncInvoices(settlementDate, settlementDate);
  }

  /** Sync invoice records into local storage. */
  async syncInvoices(startDate?: string, endDate?: string) {
    try {
      const service = getMixRadiusService();
      const dateRange = resolveSyncDateRange(startDate, endDate);
      const response = await service.fetchIncomeByPeriod({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        length: 10000,
      });
      const records = Array.isArray(response.data) ? response.data : [];

      if (records.length === 0) {
        return { success: true, count: 0 };
      }

      let syncCount = 0;
      for (const record of records) {
        await this.upsertInvoice(record);
        syncCount += 1;
      }

      return { success: true, count: syncCount };
    } catch (error: unknown) {
      if (isMixRadiusConfigError(error)) {
        return {
          success: false,
          count: 0,
          reason: getMixRadiusSyncErrorMessage(error),
        };
      }

      throw error;
    }
  }

  /** Get NPL statistics grouped by aging bucket. */
  async getNPLStatistics(groupId?: string) {
    const now = new Date();
    const service = getMixRadiusService();
    const ownerFilter = await this.getOwnerFilter(groupId);
    const response = await service.fetchCustomersPPP({ length: 10000 });
    const customers = Array.isArray(response.data) ? response.data : [];
    const stats = createNplStats();
    let totalCustomers = 0;

    const planAverageMap = buildPlanAverageMap(
      await this.repo.getInvoicePlanAverages(),
    );
    const globalAverage =
      (await this.repo.getInvoiceGlobalAverage()).averageAmount ||
      getDefaultGlobalAverage();

    customers.forEach((customer) => {
      const expiredDate = parseMixRadiusDate(customer.expired_on);
      if (
        !isCustomerIncludedByOwner(customer.owner_name, ownerFilter) ||
        !isNplCustomer({
          authStatus: customer.auth_status,
          expiredDate,
          now,
        })
      ) {
        return;
      }

      totalCustomers += 1;
      if (!expiredDate) {
        return;
      }

      const diffDays = calculateExpiredDays(now, expiredDate);
      const amount = resolveEstimatedAmount({
        customer,
        planAverageMap,
        globalAverage,
      });
      assignNplBucket(stats, diffDays, amount);
    });

    return { ...stats, totalCustomers };
  }

  private async linkCustomerToPelanggan(data: MixRadiusCustomerDetail) {
    try {
      const pelanggan = await this.findLinkedPelanggan(data);
      if (!pelanggan) {
        return false;
      }

      if (pelanggan.mixRadiusId !== data.id) {
        await this.repo.updatePelangganMixRadiusLink(pelanggan.id, data.id);
        return true;
      }

      await this.repo.updatePelangganSyncTimestamp(pelanggan.id);
      return true;
    } catch {
      return false;
    }
  }

  private async findLinkedPelanggan(data: MixRadiusCustomerDetail) {
    const pelangganByMixRadiusId = await this.repo.findPelangganByMixRadiusId(
      data.id,
    );
    if (pelangganByMixRadiusId) {
      return pelangganByMixRadiusId;
    }

    return this.repo.findPelangganByUsername(data.username);
  }

  private async upsertInvoice(
    record: MixRadiusIncomePeriodRecord,
    tenantId?: string,
  ) {
    await this.repo.upsertMixRadiusCustomer(
      buildCustomerPayloadFromInvoice(record, tenantId),
    );

    const expiredOn = parseMixRadiusDate(record.expired_on);

    return this.repo.upsertMixRadiusInvoice({
      mixRadiusId: record.id,
      tenantId: resolveTenantId(tenantId),
      invoiceNumber: record.invoice,
      username: record.username,
      fullName: record.fullname,
      ownerName: record.owner_name,
      planName: record.plan_name,
      amount: parseAmount(record.total),
      status: normalizeInvoiceStatus(record.trx_status),
      paymentMethod: record.payment_method,
      issuedDate: parseMixRadiusDate(record.renewed_on) || new Date(),
      dueDate: expiredOn,
      expiredOn,
      syncedAt: new Date(),
    });
  }

  private async getOwnerFilter(groupId?: string) {
    if (!groupId || groupId === "all") {
      return null;
    }

    const group = await this.repo.findOwnerGroupById(groupId);
    if (!group?.owners?.length) {
      return null;
    }

    return buildOwnerFilter(group.owners);
  }
}

let mixRadiusSyncServiceInstance: MixRadiusSyncService | null = null;

/** Get singleton MixRadius sync service. */
export function getMixRadiusSyncService() {
  if (!mixRadiusSyncServiceInstance) {
    mixRadiusSyncServiceInstance = new MixRadiusSyncService();
  }

  return mixRadiusSyncServiceInstance;
}

export const syncService = getMixRadiusSyncService();
