import { MixRadiusRepository } from "../repositories/MixRadiusRepository";
import {
  getCurrentMonthDateRange,
  getYesterdayDateString,
  parseMixRadiusDate,
} from "./mixradius-date-utils";
import type {
  MixRadiusCustomer,
  MixRadiusCustomerDetail,
  MixRadiusIncomePeriodRecord,
} from "./MixRadiusService";
import { getMixRadiusService } from "./MixRadiusService";

const DEFAULT_TENANT_ID = "DEFAULT";
const DEFAULT_GLOBAL_AVERAGE = 150000;
const ONE_DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;

type SyncCustomerPayload = {
  mixRadiusId: string;
  tenantId: string;
  username: string;
  fullName: string;
  address?: string;
  phoneNumber?: string;
  planName?: string;
  ownerName?: string;
  status?: string;
  expiredOn?: Date | null;
  lastSyncedAt: Date;
};

type NplStats = {
  under30: { count: number; sum: number };
  between30And60: { count: number; sum: number };
  between60And90: { count: number; sum: number };
  over90: { count: number; sum: number };
};

function resolveTenantId(tenantId?: string) {
  return tenantId || DEFAULT_TENANT_ID;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan";
}

function isMixRadiusConfigError(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "MixRadiusConfigError"
  );
}

function buildCustomerPayload(
  customer: Pick<
    MixRadiusCustomerDetail,
    | "id"
    | "username"
    | "fullname"
    | "address"
    | "phonenumber"
    | "plan_name"
    | "owner_name"
    | "auth_status"
    | "expired_on"
  >,
  tenantId?: string,
): SyncCustomerPayload {
  return {
    mixRadiusId: customer.id,
    tenantId: resolveTenantId(tenantId),
    username: customer.username,
    fullName: customer.fullname || customer.username,
    address: customer.address,
    phoneNumber: customer.phonenumber,
    planName: customer.plan_name,
    ownerName: customer.owner_name,
    status: customer.auth_status,
    expiredOn: parseMixRadiusDate(customer.expired_on),
    lastSyncedAt: new Date(),
  };
}

function buildCustomerPayloadFromInvoice(
  record: MixRadiusIncomePeriodRecord,
  tenantId?: string,
): SyncCustomerPayload {
  return {
    mixRadiusId: record.customer_id || record.username,
    tenantId: resolveTenantId(tenantId),
    username: record.username,
    fullName: record.fullname,
    address: record.address,
    phoneNumber: record.phonenumber,
    planName: record.plan_name,
    ownerName: record.owner_name,
    expiredOn: parseMixRadiusDate(record.expired_on),
    lastSyncedAt: new Date(),
  };
}

function parseAmount(amount: string | number | undefined) {
  if (!amount) {
    return 0;
  }

  return typeof amount === "number"
    ? amount
    : parseFloat(amount.replace(/[^0-9.-]+/g, "")) || 0;
}

function normalizeInvoiceStatus(status: string) {
  const upperCasedStatus = status.toUpperCase();
  return upperCasedStatus === "SUCCESS" ? "PAID" : upperCasedStatus;
}

function createNplStats(): NplStats {
  return {
    under30: { count: 0, sum: 0 },
    between30And60: { count: 0, sum: 0 },
    between60And90: { count: 0, sum: 0 },
    over90: { count: 0, sum: 0 },
  };
}

function buildOwnerFilter(owners: string[]) {
  return owners.map((owner) => owner.split(/[—–-]/)[0].trim().toLowerCase());
}

function isCustomerIncludedByOwner(
  ownerName: string | undefined,
  owners: string[] | null,
) {
  if (!owners) {
    return true;
  }

  return !!ownerName && owners.includes(ownerName.toLowerCase().trim());
}

function isNplCustomer(params: {
  authStatus: string;
  expiredDate: Date | null;
  now: Date;
}) {
  const isExpired = !!params.expiredDate && params.expiredDate < params.now;
  return (
    params.authStatus === "Disabled-Users" ||
    params.authStatus === "Isolir" ||
    (params.authStatus === "Enabled-Users" && isExpired)
  );
}

function calculateExpiredDays(now: Date, expiredDate: Date) {
  const timeDifference = now.getTime() - expiredDate.getTime();
  return Math.max(0, Math.floor(timeDifference / ONE_DAY_IN_MILLISECONDS));
}

function buildPlanAverageMap(
  planAverages: Array<{ planName: string | null; averageAmount: number }>,
) {
  const planAverageMap = new Map<string, number>();

  planAverages.forEach((planAverage) => {
    if (planAverage.planName && planAverage.averageAmount > 0) {
      planAverageMap.set(planAverage.planName, planAverage.averageAmount);
    }
  });

  return planAverageMap;
}

function resolveAmountFromPlanName(planName: string | undefined) {
  if (!planName) {
    return 0;
  }

  const planPriceMatch = planName.match(/(\d+)[kK]/);
  return planPriceMatch ? parseInt(planPriceMatch[1], 10) * 1000 : 0;
}

function resolveEstimatedAmount(params: {
  customer: Pick<MixRadiusCustomer, "total" | "plan_name">;
  planAverageMap: Map<string, number>;
  globalAverage: number;
}) {
  const directAmount = parseAmount(params.customer.total);
  if (directAmount > 0) {
    return directAmount;
  }

  if (params.customer.plan_name) {
    const planAverage = params.planAverageMap.get(params.customer.plan_name);
    if (planAverage !== undefined) {
      return planAverage;
    }
  }

  const inferredAmount = resolveAmountFromPlanName(params.customer.plan_name);
  return inferredAmount || params.globalAverage;
}

function assignNplBucket(stats: NplStats, diffDays: number, amount: number) {
  if (diffDays < 30) {
    stats.under30.count += 1;
    stats.under30.sum += amount;
    return;
  }

  if (diffDays < 60) {
    stats.between30And60.count += 1;
    stats.between30And60.sum += amount;
    return;
  }

  if (diffDays < 90) {
    stats.between60And90.count += 1;
    stats.between60And90.sum += amount;
    return;
  }

  stats.over90.count += 1;
  stats.over90.sum += amount;
}

export class MixRadiusSyncService {
  private repo: MixRadiusRepository;

  constructor() {
    this.repo = new MixRadiusRepository();
  }

  /**
   * Sync a single customer into local storage.
   */
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

  /**
   * Sync all MixRadius customers into local storage.
   */
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
          buildCustomerPayload(
            {
              ...customer,
              id: customer.id,
              auth_status: customer.auth_status,
              expired_on: customer.expired_on,
            },
            undefined,
          ),
        );
        count += 1;
      }

      return { success: true, count };
    } catch (error: unknown) {
      if (isMixRadiusConfigError(error)) {
        return { success: false, count: 0, reason: getErrorMessage(error) };
      }

      throw error;
    }
  }

  /**
   * Sync settlement data for yesterday.
   */
  async syncYesterdaySettlement() {
    const settlementDate = getYesterdayDateString();
    return this.syncInvoices(settlementDate, settlementDate);
  }

  /**
   * Sync invoice records into local storage.
   */
  async syncInvoices(startDate?: string, endDate?: string) {
    try {
      const service = getMixRadiusService();
      const dateRange =
        startDate && endDate
          ? { startDate, endDate }
          : getCurrentMonthDateRange();

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
        return { success: false, count: 0, reason: getErrorMessage(error) };
      }

      throw error;
    }
  }

  /**
   * Get NPL statistics grouped by aging bucket.
   */
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
      DEFAULT_GLOBAL_AVERAGE;

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
      let pelanggan = await this.repo.findPelangganByMixRadiusId(data.id);

      if (!pelanggan) {
        pelanggan = await this.repo.findPelangganByUsername(data.username);
      }

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
