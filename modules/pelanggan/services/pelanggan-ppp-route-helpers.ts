import { logger, logActivitySafe } from "@/lib/logger";
import { toEndOfDay } from "@/lib/utils/server-datetime";
import { CustomerEventDispatcher } from "@/modules/events";
import { RadiusSyncService } from "@/modules/network";

const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;
const BYTES_PER_GB = 1073741824;
const SECONDS_PER_HOUR = 3600;
const MILLISECONDS_PER_HOUR = 1000 * 60 * 60;
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

/** Bangun response ringkasan pemakaian pelanggan. */
export function buildUsageSummaryResponse(input: {
  pelanggan: UsageCustomerRecord;
  periodType: PeriodType;
  periodRange: { startDate: Date; endDate: Date };
  radiusStats: Awaited<
    ReturnType<RadiusSyncService["getCustomerAccountingStats"]>
  >;
  activeSession:
    | Awaited<
        ReturnType<RadiusSyncService["getCustomerActiveSessions"]>
      >[number]
    | null;
  dbStats: ReturnType<typeof createDatabaseUsageAccumulator>;
}) {
  const totalInput = Number(input.radiusStats.totalInputOctets);
  const totalOutput = Number(input.radiusStats.totalOutputOctets);
  return {
    success: true,
    customer: buildUsageCustomer(input.pelanggan),
    period: {
      type: input.periodType,
      startDate: input.periodRange.startDate.toISOString(),
      endDate: input.periodRange.endDate.toISOString(),
    },
    usage: {
      totalSessions: input.radiusStats.totalSessions,
      totalSessionTime: input.radiusStats.totalSessionTime.toString(),
      totalInputOctets: input.radiusStats.totalInputOctets.toString(),
      totalOutputOctets: input.radiusStats.totalOutputOctets.toString(),
      activeSessions: input.radiusStats.activeSessions,
      dbSessionCount: input.dbStats.sessionCount,
      dbTotalSessionTime: input.dbStats.totalSessionTime.toString(),
      dbTotalUploadBytes: input.dbStats.totalUploadBytes.toString(),
      dbTotalDownloadBytes: input.dbStats.totalDownloadBytes.toString(),
      dbTotalBytes: input.dbStats.totalBytes.toString(),
      totalSessionTimeHours: toHours(input.radiusStats.totalSessionTime),
      totalInputGB: totalInput / BYTES_PER_GB,
      totalOutputGB: totalOutput / BYTES_PER_GB,
      totalGB: (totalInput + totalOutput) / BYTES_PER_GB,
      dbTotalSessionTimeHours: toHours(input.dbStats.totalSessionTime),
      dbTotalUploadGB: Number(input.dbStats.totalUploadBytes) / BYTES_PER_GB,
      dbTotalDownloadGB:
        Number(input.dbStats.totalDownloadBytes) / BYTES_PER_GB,
      dbTotalGB: Number(input.dbStats.totalBytes) / BYTES_PER_GB,
    },
    activeSession: input.activeSession
      ? {
          sessionId: input.activeSession.acctSessionId,
          startTime: input.activeSession.acctStartTime?.toISOString(),
          nasIpAddress: input.activeSession.nasIpAddress,
        }
      : null,
  };
}

/** Map item histori radius ke response. */
export function mapRadiusHistoryItem(item: {
  radAcctId: string;
  acctSessionId?: string | null;
  acctStartTime: string | null;
  acctStopTime: string | null;
  acctSessionTime: string;
  acctInputOctets: string;
  acctOutputOctets: string;
  totalOctets: string;
  nasIpAddress?: string | null;
  framedIpAddress?: string | null;
}): {
  id: string;
  sessionId: string | null;
  sessionStartTime: string | null;
  sessionEndTime: string | null;
  sessionDuration: string;
  sessionDurationMinutes: number;
  uploadBytes: string;
  downloadBytes: string;
  totalBytes: string;
  uploadGB: number;
  downloadGB: number;
  totalGB: number;
  nasIpAddress: string | null;
  callingStationId: string | null;
  calledStationId: string | null;
  terminateCause: string | null;
  source: "radius";
} {
  return {
    id: `radius-${item.radAcctId}`,
    sessionId: item.acctSessionId ?? null,
    sessionStartTime: item.acctStartTime,
    sessionEndTime: item.acctStopTime,
    sessionDuration: item.acctSessionTime,
    sessionDurationMinutes: Number(item.acctSessionTime) / 60,
    uploadBytes: item.acctInputOctets,
    downloadBytes: item.acctOutputOctets,
    totalBytes: item.totalOctets,
    uploadGB: Number(item.acctInputOctets) / BYTES_PER_GB,
    downloadGB: Number(item.acctOutputOctets) / BYTES_PER_GB,
    totalGB: Number(item.totalOctets) / BYTES_PER_GB,
    nasIpAddress: item.nasIpAddress ?? null,
    callingStationId: null,
    calledStationId: null,
    terminateCause: null,
    source: "radius" as const,
  };
}

/** Map item histori database ke response. */
export function mapDatabaseHistoryItem(usage: {
  id: string;
  session_id: string | null;
  session_start_time: Date;
  session_end_time: Date | null;
  session_duration: bigint | null;
  upload_bytes: bigint | null;
  download_bytes: bigint | null;
  total_bytes: bigint | null;
  nas_ip_address: string | null;
  calling_station_id: string | null;
  called_station_id: string | null;
  terminate_cause: string | null;
}) {
  const totalBytes = BigInt(usage.total_bytes ?? 0);
  return {
    id: usage.id,
    sessionId: usage.session_id,
    sessionStartTime: usage.session_start_time,
    sessionEndTime: usage.session_end_time,
    sessionDuration: String(usage.session_duration ?? 0),
    sessionDurationMinutes: Number(usage.session_duration ?? 0) / 60,
    uploadBytes: String(usage.upload_bytes ?? 0),
    downloadBytes: String(usage.download_bytes ?? 0),
    totalBytes: String(usage.total_bytes ?? 0),
    uploadGB: Number(usage.upload_bytes ?? 0) / BYTES_PER_GB,
    downloadGB: Number(usage.download_bytes ?? 0) / BYTES_PER_GB,
    totalGB: Number(totalBytes) / BYTES_PER_GB,
    nasIpAddress: usage.nas_ip_address,
    callingStationId: usage.calling_station_id,
    calledStationId: usage.called_station_id,
    terminateCause: usage.terminate_cause,
    source: "database" as const,
  };
}

/** Urutkan histori usage gabungan. */
export function sortUsageHistory(
  combinedData: CombinedUsageItem[],
  sortBy: UsageSortBy,
  sortOrder: SortOrder,
) {
  return combinedData.sort((left, right) => {
    const leftValue = normalizeSortValue(left[sortBy]);
    const rightValue = normalizeSortValue(right[sortBy]);
    if (sortOrder === "asc") return leftValue > rightValue ? 1 : -1;
    return leftValue < rightValue ? 1 : -1;
  });
}

/** Bangun response histori pemakaian pelanggan. */
export function buildUsageHistoryResponse(input: {
  pelanggan: UsageCustomerRecord;
  pagination: { page: number; limit: number };
  source: UsageSource;
  dateRange: ParsedDateRange;
  combinedData: CombinedUsageItem[];
}) {
  const total = input.combinedData.length;
  const totalPages = Math.ceil(total / input.pagination.limit);
  const startIndex = (input.pagination.page - 1) * input.pagination.limit;
  return {
    success: true,
    customer: buildUsageCustomer(input.pelanggan),
    pagination: {
      page: input.pagination.page,
      limit: input.pagination.limit,
      total,
      totalPages,
    },
    filters: {
      startDate: input.dateRange.startDate?.toISOString() || null,
      endDate: input.dateRange.endDate?.toISOString() || null,
      source: input.source,
    },
    data: input.combinedData.slice(
      startIndex,
      startIndex + input.pagination.limit,
    ),
  };
}

/** Bangun where histori suspend pelanggan. */
export function buildSuspensionWhere(input: {
  id: string;
  suspensionType?: string | null;
  status: "active" | "inactive" | "all";
  dateRange: ParsedDateRange;
}) {
  return {
    pelangganId: input.id,
    ...(input.suspensionType ? { suspension_type: input.suspensionType } : {}),
    ...(input.dateRange.startDate
      ? { suspended_at: { gte: input.dateRange.startDate } }
      : {}),
    ...(input.dateRange.endDate
      ? {
          suspended_at: {
            ...(input.dateRange.startDate
              ? { gte: input.dateRange.startDate }
              : {}),
            lte: input.dateRange.endDate,
          },
        }
      : {}),
    ...(input.status === "active"
      ? { is_active: true }
      : input.status === "inactive"
        ? { is_active: false }
        : {}),
  };
}

/** Map sort histori suspend. */
export function mapSuspensionSortBy(sortBy: SuspensionSortBy) {
  if (sortBy === "actualResumeAt") return "actual_resume_at";
  if (sortBy === "suspendedBy") return "suspended_at";
  return "suspended_at";
}

/** Bangun response histori suspend pelanggan. */
export function buildSuspensionHistoryResponse(input: {
  pelanggan: UsageCustomerRecord;
  pagination: { page: number; limit: number };
  total: number;
  suspensions: Array<{
    id: string;
    suspension_type: string;
    reason: string;
    suspended_at: Date;
    suspended_by: string | null;
    expected_resume_at: Date | null;
    actual_resume_at: Date | null;
    resumed_by: string | null;
    notes: string | null;
    is_active: boolean;
  }>;
  allSuspensions: Array<{
    reason: string;
    suspended_at: Date;
    actual_resume_at: Date | null;
  }>;
  activeSuspensions: number;
  request: SuspensionHistoryInput;
  dateRange: ParsedDateRange;
}) {
  const statistics = calculateSuspensionStatistics(
    input.allSuspensions,
    input.activeSuspensions,
  );
  return {
    success: true,
    customer: buildUsageCustomer(input.pelanggan),
    pagination: {
      page: input.pagination.page,
      limit: input.pagination.limit,
      total: input.total,
      totalPages: Math.ceil(input.total / input.pagination.limit),
    },
    filters: {
      suspensionType: input.request.suspensionType || null,
      status: input.request.status,
      startDate: input.dateRange.startDate?.toISOString() || null,
      endDate: input.dateRange.endDate?.toISOString() || null,
      sortBy: input.request.sortBy,
      sortOrder: input.request.sortOrder,
    },
    statistics,
    data: input.suspensions.map(formatSuspensionItem),
  };
}

/** Tambahkan catatan suspend ke pelanggan. */
export function appendLifecycleNote(
  existingNote: string | null,
  reason: string,
  suspensionType: string,
) {
  const suspensionNote = `Service suspended: ${reason} (${suspensionType})`;
  return existingNote ? `${existingNote}\n\n${suspensionNote}` : suspensionNote;
}

/** Tambahkan catatan aktivasi ke pelanggan. */
export function appendActivationNote(
  existingNote: string | null,
  payload: { activationMethod?: string; notes?: string },
) {
  const activationMethod = payload.activationMethod || "MANUAL";
  const activationNote = `Service reactivated: ${activationMethod}${payload.notes ? ` - ${payload.notes}` : ""}`;
  return existingNote ? `${existingNote}\n\n${activationNote}` : activationNote;
}

/** Tambahkan notes aktivasi ke record suspend. */
export function appendActivationNotes(
  existingNote: string | null,
  notes?: string,
) {
  if (!notes) return existingNote;
  return `${existingNote || ""}\n\nActivation: ${notes}`.trim();
}

/** Publikasikan log suspend pelanggan. */
export function publishSuspensionLog(
  userId: string,
  pelangganId: string,
  suspensionId: string,
  payload: { suspensionType: string; reason: string },
) {
  logActivitySafe({
    action: "SUSPEND",
    subject: "Pelanggan",
    userId,
    details: {
      id: pelangganId,
      type: payload.suspensionType,
      reason: payload.reason,
      suspensionId,
    },
  });
}

/** Publikasikan log aktivasi pelanggan. */
export function publishActivationLog(
  userId: string,
  pelangganId: string,
  suspensionId: string,
  activationMethod?: string,
) {
  logActivitySafe({
    action: "ACTIVATE",
    subject: "Pelanggan",
    userId,
    details: {
      id: pelangganId,
      method: activationMethod || "MANUAL",
      suspensionId,
    },
  });
}

/** Publikasikan event suspend pelanggan. */
export function publishSuspensionEvent(
  customerId: string,
  customerName: string,
) {
  CustomerEventDispatcher.onSuspended({
    customerId,
    customerName,
    oldStatus: "AKTIF",
    newStatus: "NONAKTIF",
  }).catch((error) =>
    logger.error("Failed to publish CUSTOMER_SUSPENDED event:", error),
  );
}

/** Publikasikan event aktivasi pelanggan. */
export function publishActivationEvent(
  customerId: string,
  customerName: string,
) {
  CustomerEventDispatcher.onActivated({
    customerId,
    customerName,
    oldStatus: "NONAKTIF",
    newStatus: "AKTIF",
  }).catch((error) =>
    logger.error("Failed to publish CUSTOMER_ACTIVATED event:", error),
  );
}

/** Format response suspend pelanggan. */
export function formatSuspendResponse(
  suspension: {
    id: string;
    suspension_type: string;
    reason: string;
    notes: string | null;
    suspended_at: Date;
    expected_resume_at: Date | null;
    suspended_by: string;
    is_active: boolean;
  },
  customer: {
    id: string;
    idPelanggan: string;
    nama: string;
    username: string;
    status: string;
  } | null,
) {
  return {
    success: true,
    message: "Customer service suspended successfully",
    suspension: {
      id: suspension.id,
      suspensionType: suspension.suspension_type,
      reason: suspension.reason,
      notes: suspension.notes,
      suspendedAt: suspension.suspended_at.toISOString(),
      expectedResumeAt: suspension.expected_resume_at?.toISOString() || null,
      suspendedBy: suspension.suspended_by,
      isActive: suspension.is_active,
    },
    customer,
  };
}

/** Format response aktivasi pelanggan. */
export function formatActivateResponse(
  suspension: {
    id: string;
    suspension_type: string;
    reason: string;
    suspended_at: Date;
    actual_resume_at: Date;
    resumed_by: string;
    is_active: boolean;
    notes: string | null;
  },
  customer: {
    id: string;
    idPelanggan: string;
    nama: string;
    username: string;
    status: string;
  } | null,
) {
  return {
    success: true,
    message: "Customer service activated successfully",
    suspension: {
      id: suspension.id,
      suspensionType: suspension.suspension_type,
      reason: suspension.reason,
      suspendedAt: suspension.suspended_at.toISOString(),
      actualResumeAt: suspension.actual_resume_at.toISOString(),
      resumedBy: suspension.resumed_by,
      isActive: suspension.is_active,
      notes: suspension.notes,
    },
    customer,
  };
}

export type CombinedUsageItem =
  | ReturnType<typeof mapRadiusHistoryItem>
  | ReturnType<typeof mapDatabaseHistoryItem>;

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

function buildUsageCustomer(pelanggan: UsageCustomerRecord) {
  return {
    id: pelanggan.id,
    idPelanggan: pelanggan.idPelanggan,
    nama: pelanggan.nama,
    username: pelanggan.username,
    status: pelanggan.status,
  };
}

function toHours(value: bigint) {
  return Number(value) / SECONDS_PER_HOUR;
}

export function mapUsageSortBy(sortBy: UsageSortBy) {
  if (sortBy === "sessionDuration") return "session_duration";
  if (sortBy === "totalBytes") return "total_bytes";
  return "session_start_time";
}

function normalizeSortValue(value: unknown) {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value)))
    return new Date(value).getTime();
  if (value instanceof Date) return value.getTime();
  return value ?? 0;
}

function calculateSuspensionStatistics(
  suspensions: Array<{
    reason: string;
    suspended_at: Date;
    actual_resume_at: Date | null;
  }>,
  activeSuspensions: number,
) {
  const completed = suspensions.filter((item) => item.actual_resume_at);
  const totalHours = completed.reduce(
    (total, item) =>
      total +
      (item.actual_resume_at!.getTime() - item.suspended_at.getTime()) /
        MILLISECONDS_PER_HOUR,
    0,
  );
  const averageHours = completed.length > 0 ? totalHours / completed.length : 0;
  return {
    totalSuspensions: suspensions.length,
    activeSuspensions,
    averageSuspensionDuration: Math.round(averageHours * 100) / 100,
    mostCommonReason: calculateMostCommonReason(suspensions),
  };
}

function calculateMostCommonReason(
  suspensions: Array<{ reason: string }>,
): string | null {
  const counts = suspensions.reduce<Record<string, number>>(
    (acc, item) => ({
      ...acc,
      [item.reason || "Unknown"]: (acc[item.reason || "Unknown"] || 0) + 1,
    }),
    {},
  );
  const reasons = Object.keys(counts);
  if (reasons.length === 0) return null;
  return reasons.reduce((left, right) =>
    counts[left] > counts[right] ? left : right,
  );
}

function formatSuspensionItem(item: {
  id: string;
  suspension_type: string;
  reason: string;
  suspended_at: Date;
  suspended_by: string | null;
  expected_resume_at: Date | null;
  actual_resume_at: Date | null;
  resumed_by: string | null;
  notes: string | null;
  is_active: boolean;
}) {
  return {
    id: item.id,
    suspensionType: item.suspension_type,
    reason: item.reason,
    suspendedAt: item.suspended_at.toISOString(),
    suspendedBy: item.suspended_by,
    expectedResumeAt: item.expected_resume_at?.toISOString() || null,
    actualResumeAt: item.actual_resume_at?.toISOString() || null,
    resumedBy: item.resumed_by,
    notes: item.notes,
    isActive: item.is_active,
    durationHours: item.actual_resume_at
      ? (item.actual_resume_at.getTime() - item.suspended_at.getTime()) /
        MILLISECONDS_PER_HOUR
      : null,
  };
}
