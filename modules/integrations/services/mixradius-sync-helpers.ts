import {
  getCurrentMonthDateRange,
  getYesterdayDateString,
  parseMixRadiusDate,
} from "./mixradius-date-utils";
import type {
  MixRadiusCustomer,
  MixRadiusCustomerDetail,
  MixRadiusIncomePeriodRecord,
} from "./mixradius-types";

const DEFAULT_TENANT_ID = "DEFAULT";
const DEFAULT_GLOBAL_AVERAGE = 150000;
const ONE_DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;

export type SyncCustomerPayload = {
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

export type NplStats = {
  under30: { count: number; sum: number };
  between30And60: { count: number; sum: number };
  between60And90: { count: number; sum: number };
  over90: { count: number; sum: number };
};

export function resolveTenantId(tenantId?: string) {
  return tenantId || DEFAULT_TENANT_ID;
}

export function getMixRadiusSyncErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan";
}

export function isMixRadiusConfigError(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "MixRadiusConfigError"
  );
}

export function buildCustomerPayload(
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

export function buildCustomerPayloadFromInvoice(
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

export function parseAmount(amount: string | number | undefined) {
  if (!amount) {
    return 0;
  }

  return typeof amount === "number"
    ? amount
    : parseFloat(amount.replace(/[^0-9.-]+/g, "")) || 0;
}

export function normalizeInvoiceStatus(status: string) {
  const upperCasedStatus = status.toUpperCase();
  return upperCasedStatus === "SUCCESS" ? "PAID" : upperCasedStatus;
}

export function createNplStats(): NplStats {
  return {
    under30: { count: 0, sum: 0 },
    between30And60: { count: 0, sum: 0 },
    between60And90: { count: 0, sum: 0 },
    over90: { count: 0, sum: 0 },
  };
}

export function buildOwnerFilter(owners: string[]) {
  return owners.map((owner) => owner.split(/[—–-]/)[0].trim().toLowerCase());
}

export function isCustomerIncludedByOwner(
  ownerName: string | undefined,
  owners: string[] | null,
) {
  return (
    !owners || (!!ownerName && owners.includes(ownerName.toLowerCase().trim()))
  );
}

export function isNplCustomer(params: {
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

export function calculateExpiredDays(now: Date, expiredDate: Date) {
  return Math.max(
    0,
    Math.floor(
      (now.getTime() - expiredDate.getTime()) / ONE_DAY_IN_MILLISECONDS,
    ),
  );
}

export function buildPlanAverageMap(
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

export function resolveEstimatedAmount(params: {
  customer: Pick<MixRadiusCustomer, "total" | "plan_name">;
  planAverageMap: Map<string, number>;
  globalAverage: number;
}) {
  const directAmount = parseAmount(params.customer.total);
  if (directAmount > 0) {
    return directAmount;
  }

  const planName = params.customer.plan_name;
  const planAverage = planName
    ? params.planAverageMap.get(planName)
    : undefined;
  if (planAverage !== undefined) {
    return planAverage;
  }

  return resolveAmountFromPlanName(planName) || params.globalAverage;
}

export function assignNplBucket(
  stats: NplStats,
  diffDays: number,
  amount: number,
) {
  if (diffDays < 30) {
    incrementBucket(stats.under30, amount);
    return;
  }

  if (diffDays < 60) {
    incrementBucket(stats.between30And60, amount);
    return;
  }

  if (diffDays < 90) {
    incrementBucket(stats.between60And90, amount);
    return;
  }

  incrementBucket(stats.over90, amount);
}

export function resolveSyncDateRange(startDate?: string, endDate?: string) {
  return startDate && endDate
    ? { startDate, endDate }
    : getCurrentMonthDateRange();
}

export function getYesterdaySettlementDate() {
  return getYesterdayDateString();
}

export function getDefaultGlobalAverage() {
  return DEFAULT_GLOBAL_AVERAGE;
}

function incrementBucket(
  bucket: { count: number; sum: number },
  amount: number,
) {
  bucket.count += 1;
  bucket.sum += amount;
}

function resolveAmountFromPlanName(planName: string | undefined) {
  const planPriceMatch = planName?.match(/(\d+)[kK]/);
  return planPriceMatch ? parseInt(planPriceMatch[1], 10) * 1000 : 0;
}
