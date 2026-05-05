import { toEndOfDay } from "@/lib/utils/server-datetime";

export {
  buildUsageHistoryResponse,
  mapDatabaseHistoryItem,
  mapRadiusHistoryItem,
  sortUsageHistory,
  type CombinedUsageItem,
} from "./pelanggan-ppp-usage-history-mapper";
export {
  buildUsageSummaryResponse,
  type UsageSummaryResponseInput,
} from "./pelanggan-ppp-route-summary.helpers";
export {
  buildSuspensionHistoryResponse,
  buildSuspensionWhere,
  mapSuspensionSortBy,
} from "./pelanggan-ppp-suspension-history-mapper";
export {
  appendActivationNote,
  appendActivationNotes,
  appendLifecycleNote,
  formatActivateResponse,
  formatSuspendResponse,
  publishActivationEvent,
  publishActivationLog,
  publishSuspensionEvent,
  publishSuspensionLog,
} from "./pelanggan-ppp-lifecycle-route-formatters";

const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;
const LAST_SEVEN_DAYS = 7;
const LAST_THIRTY_DAYS = 30;
const DATE_END_HOUR = 23;
const DATE_END_MINUTE = 59;
const DATE_END_SECOND = 59;
const DATE_END_MILLISECOND = 999;

export { DEFAULT_PAGE, MAX_LIMIT };

export type UsageSource = "all" | "radius" | "database";
export type UsageSortBy = "sessionStartTime" | "sessionDuration" | "totalBytes";
export type SortOrder = "asc" | "desc";
export type SuspensionSortBy = "suspendedAt" | "actualResumeAt" | "suspendedBy";
export type PeriodType =
  | "current_month"
  | "last_month"
  | "last_7_days"
  | "last_30_days"
  | "custom";
export type UsageSummaryInput = {
  id: string;
  tenantId?: string | null;
  period: PeriodType;
  startDate?: string | null;
  endDate?: string | null;
};
export type UsageHistoryInput = {
  id: string;
  tenantId?: string | null;
  page: number;
  limit: number;
  startDate?: string | null;
  endDate?: string | null;
  source: UsageSource;
  sortBy: UsageSortBy;
  sortOrder: SortOrder;
};
export type SuspensionHistoryInput = {
  id: string;
  page: number;
  limit: number;
  suspensionType?: string | null;
  status: "active" | "inactive" | "all";
  startDate?: string | null;
  endDate?: string | null;
  sortBy: SuspensionSortBy;
  sortOrder: SortOrder;
};
export type UsageCustomerRecord = {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  status: string;
  tenantId: string | null;
  catatan: string | null;
};
export type ParsedDateRange = {
  startDate?: Date;
  endDate?: Date;
};

/** Buat kandidat ID pelanggan. */
export function createCandidateId() {
  const timestampPart = String(Date.now()).slice(-5);
  const random = Math.floor(Math.random() * 1000);
  return timestampPart + String(random).padStart(3, "0");
}

/** Buat fallback ID pelanggan. */
export function createFallbackId() {
  const timestampPart = String(Date.now()).slice(-6);
  const random = Math.floor(Math.random() * 10000);
  return timestampPart + String(random).padStart(2, "0");
}

/** Validasi pagination route pelanggan. */
export function normalizePagination(page: number, limit: number) {
  if (page < DEFAULT_PAGE || limit < DEFAULT_PAGE || limit > MAX_LIMIT) {
    throw new Error("Parameter paginasi tidak valid");
  }
  return { page, limit };
}

/** Parse periode pemakaian pelanggan. */
export function parseUsagePeriod(input: UsageSummaryInput) {
  const now = new Date();
  if (input.period === "current_month")
    return createMonthRange(now.getFullYear(), now.getMonth());
  if (input.period === "last_month")
    return createMonthRange(now.getFullYear(), now.getMonth() - 1);
  if (input.period === "last_7_days")
    return createRelativeRange(now, LAST_SEVEN_DAYS);
  if (input.period === "last_30_days")
    return createRelativeRange(now, LAST_THIRTY_DAYS);
  if (input.period !== "custom")
    throw new Error("Parameter periode tidak valid");
  return parseCustomPeriod(input.startDate, input.endDate);
}

/** Parse rentang tanggal generik. */
export function parseDateRange(
  startDate?: string | null,
  endDate?: string | null,
) {
  const parsedStartDate = parseDateValue(startDate, "startDate");
  const parsedEndDate = parseDateValue(endDate, "endDate", true);
  return { startDate: parsedStartDate, endDate: parsedEndDate };
}

/** Pastikan tenant pelanggan tersedia. */
export function ensureTenantId(tenantId: string | null) {
  if (!tenantId) throw new Error("Customer tenant not found");
  return tenantId;
}

/** Buat accumulator statistik database usage. */
export function createDatabaseUsageAccumulator() {
  return {
    totalSessionTime: BigInt(0),
    totalUploadBytes: BigInt(0),
    totalDownloadBytes: BigInt(0),
    totalBytes: BigInt(0),
    sessionCount: 0,
  };
}

function createMonthRange(year: number, month: number) {
  return {
    startDate: new Date(year, month, 1),
    endDate: new Date(
      year,
      month + 1,
      0,
      DATE_END_HOUR,
      DATE_END_MINUTE,
      DATE_END_SECOND,
      DATE_END_MILLISECOND,
    ),
  };
}

function createRelativeRange(now: Date, dayCount: number) {
  return {
    startDate: new Date(now.getTime() - dayCount * 24 * 60 * 60 * 1000),
    endDate: now,
  };
}

function parseCustomPeriod(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate)
    throw new Error("Custom period requires startDate and endDate parameters");
  const parsedStartDate = new Date(startDate);
  const parsedEndDate = new Date(endDate);
  if (
    Number.isNaN(parsedStartDate.getTime()) ||
    Number.isNaN(parsedEndDate.getTime())
  )
    throw new Error("Format tanggal tidak valid. Gunakan format YYYY-MM-DD");
  return { startDate: parsedStartDate, endDate: parsedEndDate };
}

function parseDateValue(
  value?: string | null,
  label = "date",
  endOfDay = false,
) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error(`Format ${label} tidak valid. Gunakan format YYYY-MM-DD`);
  return endOfDay ? new Date(toEndOfDay(date).getTime()) : date;
}

export function mapUsageSortBy(sortBy: UsageSortBy) {
  if (sortBy === "sessionDuration") return "session_duration";
  if (sortBy === "totalBytes") return "total_bytes";
  return "session_start_time";
}
