import { logger } from "@/lib/logger";
import { parseOptionalDate } from "@/lib/utils/server-datetime";
import type {
  IMixRadiusDataRepository,
  UpsertMixRadiusCustomerInput,
} from "../domain/ports/IMixRadiusDataRepository";
import { MixRadiusRepository } from "../repositories/MixRadiusRepository";
import type {
  MixRadiusCustomerDetail,
  MixRadiusIncomePeriodRecord,
} from "./MixRadiusService";
import { getMixRadiusService } from "./MixRadiusService";

const DEFAULT_GLOBAL_AVERAGE_AMOUNT = 150000;
const DEFAULT_TENANT_ID = "DEFAULT";
const DAYS_30 = 30;
const DAYS_60 = 60;
const DAYS_90 = 90;
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

export class MixRadiusSyncService {
  constructor(
    private readonly mixRadiusRepository: IMixRadiusDataRepository = new MixRadiusRepository(),
  ) {}

  /** Sync a single customer into local storage. */
  async syncCustomer(data: MixRadiusCustomerDetail, tenantId?: string) {
    this.ensureUsername(data.username);

    const customerPayload = this.buildCustomerSyncPayload(data, tenantId);
    const customer =
      await this.mixRadiusRepository.upsertMixRadiusCustomer(customerPayload);
    const linked = await this.linkPelanggan(data);

    return { action: "synced", customer, linked };
  }

  /** Sync all MixRadius customers into local storage. */
  async syncAllCustomers() {
    try {
      const service = getMixRadiusService();
      const response = await service.fetchCustomersPPP({ length: 10000 });

      if (!response.data || !Array.isArray(response.data)) {
        return { success: true, count: 0 };
      }

      let count = 0;
      for (const customer of response.data) {
        const payload = this.buildBulkCustomerPayload(customer);
        await this.mixRadiusRepository.upsertMixRadiusCustomer(payload);
        count += 1;
      }

      return { success: true, count };
    } catch (error: unknown) {
      return this.handleSyncError(
        error,
        "pelanggan",
        "Full customer sync error",
      );
    }
  }

  /** Sync yesterday settlement invoices. */
  async syncYesterdaySettlement() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    logger.info(`[MixRadiusSync] Running daily settlement sync for ${dateStr}`);
    return this.syncInvoices(dateStr, dateStr);
  }

  /** Sync MixRadius invoices for a date range. */
  async syncInvoices(startDate?: string, endDate?: string) {
    try {
      const service = getMixRadiusService();
      const { start, end } = this.resolveInvoiceRange(startDate, endDate);
      const response = await service.fetchIncomeByPeriod({
        startDate: start,
        endDate: end,
        length: 10000,
      });

      if (!response.data || !Array.isArray(response.data)) {
        return { success: true, count: 0 };
      }

      let syncCount = 0;
      for (const record of response.data) {
        syncCount += await this.syncInvoiceRecord(record);
      }

      return { success: true, count: syncCount };
    } catch (error: unknown) {
      return this.handleSyncError(error, "invoice", "Invoice sync error");
    }
  }

  /** Get NPL statistics from MixRadius customers. */
  async getNPLStatistics(groupId?: string) {
    const service = getMixRadiusService();
    const owners = await this.resolveGroupOwners(groupId);
    const response = await service.fetchCustomersPPP({ length: 10000 });
    const allCustomers = response.data || [];
    const stats = this.createEmptyNplStats();
    const planAverageMap = await this.getPlanAverageMap();
    const globalAverage = await this.getGlobalAverageAmount();
    let totalCustomers = 0;
    const now = new Date();

    for (const customer of allCustomers) {
      if (!this.isOwnerIncluded(customer.owner_name, owners)) {
        continue;
      }

      totalCustomers += 1;
      this.accumulateNplStats({
        customer,
        stats,
        now,
        planAverageMap,
        globalAverage,
      });
    }

    return { ...stats, totalCustomers };
  }

  /** Parse a MixRadius date string safely. */
  private parseDate(dateStr: string | null | undefined): Date | null {
    if (dateStr === "0000-00-00 00:00:00") {
      return null;
    }

    return parseOptionalDate(dateStr);
  }

  /** Ensure username exists before sync. */
  private ensureUsername(username: string) {
    if (!username) {
      throw new Error("Username diperlukan untuk sinkronisasi");
    }
  }

  /** Build customer sync payload from customer detail. */
  private buildCustomerSyncPayload(
    data: MixRadiusCustomerDetail,
    tenantId?: string,
  ): UpsertMixRadiusCustomerInput {
    return {
      mixRadiusId: data.id,
      tenantId: tenantId || DEFAULT_TENANT_ID,
      username: data.username,
      fullName: data.fullname || data.username,
      address: data.address,
      phoneNumber: data.phonenumber,
      planName: data.plan_name,
      ownerName: data.owner_name,
      status: data.auth_status,
      expiredOn: this.parseDate(data.expired_on),
      lastSyncedAt: new Date(),
    };
  }

  /** Build bulk customer payload from customer list item. */
  private buildBulkCustomerPayload(customer: {
    id: string;
    username: string;
    fullname: string;
    owner_name: string;
    auth_status: string;
    expired_on: string;
  }): UpsertMixRadiusCustomerInput {
    return {
      mixRadiusId: customer.id,
      tenantId: DEFAULT_TENANT_ID,
      username: customer.username,
      fullName: customer.fullname,
      ownerName: customer.owner_name,
      status: customer.auth_status,
      expiredOn: this.parseDate(customer.expired_on),
      lastSyncedAt: new Date(),
    };
  }

  /** Link synced customer to pelanggan if found. */
  private async linkPelanggan(data: MixRadiusCustomerDetail) {
    let linkedToPelanggan = false;

    try {
      const pelanggan = await this.findMatchingPelanggan(
        data.id,
        data.username,
      );

      if (!pelanggan) {
        return false;
      }

      if (pelanggan.mixRadiusId !== data.id) {
        await this.mixRadiusRepository.updatePelangganMixRadiusLink(
          pelanggan.id,
          data.id,
        );
      } else {
        await this.mixRadiusRepository.updatePelangganSyncTimestamp(
          pelanggan.id,
        );
      }

      linkedToPelanggan = true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan";
      logger.warn(
        `[MixRadiusSync] Failed to link to Pelanggan table: ${message}`,
      );
    }

    return linkedToPelanggan;
  }

  /** Find pelanggan by MixRadius id or username. */
  private async findMatchingPelanggan(mixRadiusId: string, username: string) {
    const pelangganByMixRadius =
      await this.mixRadiusRepository.findPelangganByMixRadiusId(mixRadiusId);

    if (pelangganByMixRadius) {
      return pelangganByMixRadius;
    }

    return this.mixRadiusRepository.findPelangganByUsername(username);
  }

  /** Resolve invoice sync date range. */
  private resolveInvoiceRange(startDate?: string, endDate?: string) {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const start = startDate || `${year}-${month}-01`;
    const end = endDate || `${year}-${month}-${lastDay}`;

    return { start, end };
  }

  /** Sync a single invoice record. */
  private async syncInvoiceRecord(record: MixRadiusIncomePeriodRecord) {
    try {
      await this.upsertInvoice(record, undefined);
      return 1;
    } catch (error) {
      logger.error(
        `[MixRadiusSync] Failed to sync invoice ${record.invoice}:`,
        error,
      );
      return 0;
    }
  }

  /** Upsert invoice-related local records. */
  private async upsertInvoice(
    record: MixRadiusIncomePeriodRecord,
    tenantId?: string,
  ) {
    const finalTenantId = tenantId || DEFAULT_TENANT_ID;
    const mixRadiusId = record.customer_id || record.username;
    const expiredOn = this.parseDate(record.expired_on);
    const issuedDate = this.parseDate(record.renewed_on) || new Date();

    await this.mixRadiusRepository.upsertMixRadiusCustomer({
      mixRadiusId,
      tenantId: finalTenantId,
      username: record.username,
      fullName: record.fullname,
      ownerName: record.owner_name,
      address: record.address,
      phoneNumber: record.phonenumber,
      planName: record.plan_name,
      lastSyncedAt: new Date(),
    });

    await this.mixRadiusRepository.upsertMixRadiusInvoice({
      mixRadiusId: record.id,
      tenantId: finalTenantId,
      invoiceNumber: record.invoice,
      username: record.username,
      fullName: record.fullname,
      ownerName: record.owner_name,
      planName: record.plan_name,
      amount: this.parseAmount(record.total),
      status: this.normalizeInvoiceStatus(record.trx_status),
      paymentMethod: record.payment_method,
      issuedDate,
      dueDate: expiredOn,
      expiredOn,
      syncedAt: new Date(),
    });
  }

  /** Parse invoice amount safely. */
  private parseAmount(rawAmount: string) {
    return parseFloat(rawAmount.replace(/[^0-9.-]+/g, "")) || 0;
  }

  /** Normalize invoice transaction status. */
  private normalizeInvoiceStatus(status: string) {
    const normalizedStatus = status.toUpperCase();
    return normalizedStatus === "SUCCESS" ? "PAID" : normalizedStatus;
  }

  /** Handle config-aware sync errors. */
  private handleSyncError(error: unknown, subject: string, logLabel: string) {
    if (this.isConfigError(error)) {
      const message = this.getErrorMessage(error);
      logger.warn(
        `[MixRadiusSync] Berhenti sinkronisasi ${subject}: ${message}`,
      );
      return { success: false, count: 0, reason: message };
    }

    logger.error(`[MixRadiusSync] ${logLabel}:`, error);
    throw error;
  }

  /** Check whether error is a MixRadius config error. */
  private isConfigError(error: unknown) {
    return Boolean(
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "MixRadiusConfigError",
    );
  }

  /** Get safe error message text. */
  private getErrorMessage(error: unknown) {
    return error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "Unknown error";
  }

  /** Resolve normalized owners for a selected group. */
  private async resolveGroupOwners(groupId?: string) {
    if (!groupId || groupId === "all") {
      return null;
    }

    const group = await this.mixRadiusRepository.findOwnerGroupById(groupId);
    if (!group?.owners?.length) {
      return null;
    }

    return group.owners.map((owner) => this.normalizeOwnerKey(owner));
  }

  /** Normalize owner key for matching. */
  private normalizeOwnerKey(owner: string) {
    return owner.split(/[—–-]/)[0].trim().toLowerCase();
  }

  /** Create the initial NPL stats object. */
  private createEmptyNplStats() {
    return {
      under30: { count: 0, sum: 0 },
      between30And60: { count: 0, sum: 0 },
      between60And90: { count: 0, sum: 0 },
      over90: { count: 0, sum: 0 },
    };
  }

  /** Build a map of average invoice amounts by plan. */
  private async getPlanAverageMap() {
    const averages = await this.mixRadiusRepository.getInvoicePlanAverages();
    const planAverageMap = new Map<string, number>();

    averages.forEach((average) => {
      if (average.planName && average.averageAmount > 0) {
        planAverageMap.set(average.planName, average.averageAmount);
      }
    });

    return planAverageMap;
  }

  /** Get the global average invoice amount. */
  private async getGlobalAverageAmount() {
    const average = await this.mixRadiusRepository.getInvoiceGlobalAverage();
    return average.averageAmount || DEFAULT_GLOBAL_AVERAGE_AMOUNT;
  }

  /** Check whether owner should be included. */
  private isOwnerIncluded(ownerName: string, owners: string[] | null) {
    if (!owners) {
      return true;
    }

    return Boolean(
      ownerName && owners.includes(ownerName.toLowerCase().trim()),
    );
  }

  /** Accumulate NPL statistics for a single customer. */
  private accumulateNplStats(params: {
    customer: {
      auth_status: string;
      expired_on: string;
      total: string | number;
      plan_name: string;
    };
    stats: ReturnType<MixRadiusSyncService["createEmptyNplStats"]>;
    now: Date;
    planAverageMap: Map<string, number>;
    globalAverage: number;
  }) {
    const { customer, stats, now, planAverageMap, globalAverage } = params;
    const expiredDate = this.parseDate(customer.expired_on);

    if (
      !expiredDate ||
      !this.isNplCustomer(customer.auth_status, expiredDate, now)
    ) {
      return;
    }

    const overdueDays = this.calculateOverdueDays(now, expiredDate);
    const amount = this.resolveCustomerAmount(
      customer.total,
      customer.plan_name,
      planAverageMap,
      globalAverage,
    );

    if (overdueDays < DAYS_30) {
      this.addNplBucket(stats.under30, amount);
      return;
    }

    if (overdueDays < DAYS_60) {
      this.addNplBucket(stats.between30And60, amount);
      return;
    }

    if (overdueDays < DAYS_90) {
      this.addNplBucket(stats.between60And90, amount);
      return;
    }

    this.addNplBucket(stats.over90, amount);
  }

  /** Check whether customer is in NPL status. */
  private isNplCustomer(authStatus: string, expiredDate: Date, now: Date) {
    if (authStatus === "Disabled-Users" || authStatus === "Isolir") {
      return true;
    }

    return authStatus === "Enabled-Users" && expiredDate < now;
  }

  /** Calculate overdue days. */
  private calculateOverdueDays(now: Date, expiredDate: Date) {
    const diffTime = now.getTime() - expiredDate.getTime();
    return Math.max(0, Math.floor(diffTime / MILLISECONDS_PER_DAY));
  }

  /** Resolve customer amount from direct total or plan estimates. */
  private resolveCustomerAmount(
    total: string | number,
    planName: string,
    planAverageMap: Map<string, number>,
    globalAverage: number,
  ) {
    const directAmount = this.parseDirectAmount(total);

    if (directAmount > 0) {
      return directAmount;
    }

    const planAverage = planName ? planAverageMap.get(planName) : undefined;
    if (planAverage !== undefined) {
      return planAverage;
    }

    return this.parsePlanNameAmount(planName) || globalAverage;
  }

  /** Parse amount from total field. */
  private parseDirectAmount(total: string | number) {
    if (!total) {
      return 0;
    }

    if (typeof total === "string") {
      return parseFloat(total.replace(/[^0-9.-]+/g, "")) || 0;
    }

    return Number(total);
  }

  /** Parse amount hint from plan name. */
  private parsePlanNameAmount(planName: string) {
    const match = planName?.match(/(\d+)[kK]/);
    return match?.[1] ? parseInt(match[1], 10) * 1000 : 0;
  }

  /** Add value into an NPL bucket. */
  private addNplBucket(bucket: { count: number; sum: number }, amount: number) {
    bucket.count += 1;
    bucket.sum += amount;
  }
}

let syncServiceInstance: MixRadiusSyncService | null = null;

/** Return the shared MixRadius sync service lazily. */
export function getMixRadiusSyncService(): MixRadiusSyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new MixRadiusSyncService();
  }

  return syncServiceInstance;
}
