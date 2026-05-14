import { MixRadiusOwnerGroupFacadeService } from "./MixRadiusOwnerGroupFacadeService";
import {
  buildMixRadiusOwnerLookup,
  isMixRadiusOwnerAllowed,
  normalizeMixRadiusOwnerName,
} from "@/modules/integrations/services/mixradius-owner-normalizer";

import type {
  FetchCustomersParams,
  MixRadiusIncomePeriodRecord,
} from "./mixradius-types";

const ONLINE_PAYMENT_KEYWORDS = [
  "dtk",
  "tripay",
  "xendit",
  "midtrans",
  "doku",
  "ipaymu",
  "mayar",
  "faspay",
  "winpay",
  "auto",
] as const;
const ownerGroupService = new MixRadiusOwnerGroupFacadeService();

/** Apply supported income filters after upstream fetch. */
export async function applyIncomeFilters(
  records: MixRadiusIncomePeriodRecord[],
  filters: FetchCustomersParams,
): Promise<MixRadiusIncomePeriodRecord[]> {
  let filteredRecords = filterByDate(
    records,
    filters.startDate,
    filters.endDate,
  );
  filteredRecords = await filterBySite(filteredRecords, filters.siteId);
  filteredRecords = await filterByGroup(filteredRecords, filters.groupId);
  filteredRecords = filterByOwnerId(filteredRecords, filters.ownerId);
  filteredRecords = filterByServiceType(filteredRecords, filters.serviceType);
  filteredRecords = filterByPaymentMethod(
    filteredRecords,
    filters.paymentMethod,
  );
  filteredRecords = filterBySearch(filteredRecords, filters.search);
  return sortIncomeRecords(filteredRecords, filters.sortBy, filters.sortDir);
}

/** Build paginated record slice from filtered income rows. */
export function paginateIncomeRecords(
  records: MixRadiusIncomePeriodRecord[],
  start: number,
  length: number,
) {
  return records.slice(start, start + length);
}

function filterByDate(
  records: MixRadiusIncomePeriodRecord[],
  startDate?: string,
  endDate?: string,
) {
  if (!startDate || !endDate) {
    return records;
  }

  const startTime = new Date(
    startDate.includes(" ") ? startDate : `${startDate} 00:00:00`,
  ).getTime();
  const endTime = new Date(
    endDate.includes(" ") ? endDate : `${endDate} 23:59:59`,
  ).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return records;
  }

  return records.filter((record) => {
    const renewedTime = record.renewed_on
      ? new Date(record.renewed_on).getTime()
      : Number.NaN;
    return (
      !Number.isNaN(renewedTime) &&
      renewedTime >= startTime &&
      renewedTime <= endTime
    );
  });
}

async function filterBySite(
  records: MixRadiusIncomePeriodRecord[],
  siteId?: string,
) {
  if (!siteId) {
    return records;
  }

  const siteOwners = await ownerGroupService.getOwnersBySiteId(siteId);
  const allowedOwners = buildMixRadiusOwnerLookup(siteOwners);
  return records.filter((record) =>
    isMixRadiusOwnerAllowed(record.owner_name, allowedOwners),
  );
}

async function filterByGroup(
  records: MixRadiusIncomePeriodRecord[],
  groupId?: string,
) {
  if (!groupId) {
    return records;
  }

  const groupOwners = await ownerGroupService.getOwnersByGroupId(groupId);
  if (!groupOwners) {
    return [];
  }

  const allowedOwners = buildMixRadiusOwnerLookup(groupOwners);
  return records.filter((record) =>
    isMixRadiusOwnerAllowed(record.owner_name, allowedOwners),
  );
}

function filterByOwnerId(
  records: MixRadiusIncomePeriodRecord[],
  ownerId?: string,
) {
  if (!ownerId || ownerId === "all") {
    return records;
  }

  const targetOwner = normalizeMixRadiusOwnerName(ownerId);
  return records.filter((record) => {
    if (!record.owner_name) {
      return false;
    }
    const candidateOwner = normalizeMixRadiusOwnerName(record.owner_name);
    return (
      candidateOwner.full === targetOwner.full ||
      candidateOwner.prefix === targetOwner.prefix
    );
  });
}

function filterByServiceType(
  records: MixRadiusIncomePeriodRecord[],
  serviceType?: string,
) {
  if (!serviceType) {
    return records;
  }

  const normalizedServiceType = serviceType.toUpperCase();
  return records.filter((record) =>
    matchesServiceType(record, normalizedServiceType),
  );
}

function matchesServiceType(
  record: MixRadiusIncomePeriodRecord,
  normalizedServiceType: string,
) {
  const itemType = (record.type || "").toUpperCase();
  const itemPlan = (record.plan_name || "").toUpperCase();
  const itemNasPort = (record.nasporttype || "").toUpperCase();
  const isPpp =
    itemType.includes("PPP") ||
    itemType.includes("PPPOE") ||
    itemPlan.includes("PPP") ||
    itemPlan.includes("HOME") ||
    itemPlan.includes("DEDICATED") ||
    itemPlan.includes("MB");
  const isHotspot =
    itemType.includes("HOTSPOT") ||
    itemType.includes("VOUCHER") ||
    itemPlan.includes("HOTSPOT") ||
    itemPlan.includes("VC") ||
    itemPlan.includes("VOUCHER");

  if (normalizedServiceType === "PPP") {
    return isPpp || (!isHotspot && itemNasPort.includes("ETHERNET"));
  }

  if (normalizedServiceType === "HOTSPOT") {
    return isHotspot || (!isPpp && itemNasPort.includes("WIRELESS"));
  }

  return true;
}

function filterByPaymentMethod(
  records: MixRadiusIncomePeriodRecord[],
  paymentMethod?: string,
) {
  if (!paymentMethod) {
    return records;
  }

  const normalizedPaymentMethod = paymentMethod.toLowerCase();
  return records.filter((record) => {
    const method = (record.payment_method || record.method || "")
      .toLowerCase()
      .trim();
    const type = (record.payment_type || "").toLowerCase();
    const isOnline = ONLINE_PAYMENT_KEYWORDS.some(
      (keyword) => method.includes(keyword) || type.includes(keyword),
    );
    if (normalizedPaymentMethod === "online") return isOnline;
    if (normalizedPaymentMethod === "manual") return !isOnline;
    return true;
  });
}

function filterBySearch(
  records: MixRadiusIncomePeriodRecord[],
  search?: string,
) {
  if (!search) {
    return records;
  }

  const normalizedSearch = search.toLowerCase();
  return records.filter((record) =>
    [
      record.invoice,
      record.username,
      record.fullname,
      record.member_id,
      record.owner_name,
    ].some((value) => value?.toLowerCase().includes(normalizedSearch)),
  );
}

const NUMERIC_SORT_COLUMNS = new Set([
  "total",
  "seller_fee",
  "price",
  "tax",
  "fee",
]);

function sortIncomeRecords(
  records: MixRadiusIncomePeriodRecord[],
  sortBy = "renewed_on",
  sortDir: "asc" | "desc" = "desc",
) {
  const sortedRecords = [...records];
  return sortedRecords.sort((left, right) => {
    const leftValue = (left as unknown as Record<string, unknown>)[sortBy];
    const rightValue = (right as unknown as Record<string, unknown>)[sortBy];

    if (["renewed_on", "invoice_date"].includes(sortBy)) {
      const leftTime = leftValue ? new Date(String(leftValue)).getTime() : 0;
      const rightTime = rightValue ? new Date(String(rightValue)).getTime() : 0;
      return sortDir === "asc" ? leftTime - rightTime : rightTime - leftTime;
    }

    if (NUMERIC_SORT_COLUMNS.has(sortBy)) {
      const numLeft =
        parseFloat(String(leftValue || "0").replace(/[^0-9.-]/g, "")) || 0;
      const numRight =
        parseFloat(String(rightValue || "0").replace(/[^0-9.-]/g, "")) || 0;
      return sortDir === "asc" ? numLeft - numRight : numRight - numLeft;
    }

    const normalizedLeft = String(leftValue || "").toLowerCase();
    const normalizedRight = String(rightValue || "").toLowerCase();
    if (normalizedLeft < normalizedRight) return sortDir === "asc" ? -1 : 1;
    if (normalizedLeft > normalizedRight) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}
