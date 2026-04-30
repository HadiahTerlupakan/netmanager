import type {
  ParsedDateRange,
  SuspensionHistoryInput,
  SuspensionSortBy,
  UsageCustomerRecord,
} from "./pelanggan-ppp-route-helpers";

const MILLISECONDS_PER_HOUR = 1000 * 60 * 60;

export type SuspensionHistoryResponseInput = {
  pelanggan: UsageCustomerRecord;
  pagination: { page: number; limit: number };
  total: number;
  suspensions: SuspensionHistoryItem[];
  allSuspensions: SuspensionStatisticsItem[];
  activeSuspensions: number;
  request: SuspensionHistoryInput;
  dateRange: ParsedDateRange;
};

type SuspensionHistoryItem = {
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
};

type SuspensionStatisticsItem = {
  reason: string;
  suspended_at: Date;
  actual_resume_at: Date | null;
};

/** Bangun where histori suspend pelanggan. */
export function buildSuspensionWhere(input: {
  id: string;
  suspensionType?: string | null;
  status: "active" | "inactive" | "all";
  dateRange: ParsedDateRange;
}) {
  return {
    pelangganId: input.id,
    ...buildSuspensionTypeFilter(input.suspensionType),
    ...buildSuspendedAtFilter(input.dateRange),
    ...buildSuspensionStatusFilter(input.status),
  };
}

/** Map sort histori suspend. */
export function mapSuspensionSortBy(sortBy: SuspensionSortBy) {
  if (sortBy === "actualResumeAt") return "actual_resume_at";
  if (sortBy === "suspendedBy") return "suspended_at";
  return "suspended_at";
}

/** Bangun response histori suspend pelanggan. */
export function buildSuspensionHistoryResponse(
  input: SuspensionHistoryResponseInput,
) {
  return {
    success: true,
    customer: buildUsageCustomer(input.pelanggan),
    pagination: buildSuspensionPagination(input),
    filters: buildSuspensionFilters(input),
    statistics: calculateSuspensionStatistics(
      input.allSuspensions,
      input.activeSuspensions,
    ),
    data: input.suspensions.map(formatSuspensionItem),
  };
}

function buildSuspensionTypeFilter(suspensionType?: string | null) {
  return suspensionType ? { suspension_type: suspensionType } : {};
}

function buildSuspendedAtFilter(dateRange: ParsedDateRange) {
  if (!dateRange.startDate && !dateRange.endDate) return {};
  return {
    suspended_at: {
      ...(dateRange.startDate ? { gte: dateRange.startDate } : {}),
      ...(dateRange.endDate ? { lte: dateRange.endDate } : {}),
    },
  };
}

function buildSuspensionStatusFilter(status: "active" | "inactive" | "all") {
  if (status === "active") return { is_active: true };
  if (status === "inactive") return { is_active: false };
  return {};
}

function buildSuspensionPagination(input: SuspensionHistoryResponseInput) {
  return {
    page: input.pagination.page,
    limit: input.pagination.limit,
    total: input.total,
    totalPages: Math.ceil(input.total / input.pagination.limit),
  };
}

function buildSuspensionFilters(input: SuspensionHistoryResponseInput) {
  return {
    suspensionType: input.request.suspensionType || null,
    status: input.request.status,
    startDate: input.dateRange.startDate?.toISOString() || null,
    endDate: input.dateRange.endDate?.toISOString() || null,
    sortBy: input.request.sortBy,
    sortOrder: input.request.sortOrder,
  };
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

function calculateSuspensionStatistics(
  suspensions: SuspensionStatisticsItem[],
  activeSuspensions: number,
) {
  const completed = suspensions.filter((item) => item.actual_resume_at);
  const averageHours = calculateAverageSuspensionHours(completed);
  return {
    totalSuspensions: suspensions.length,
    activeSuspensions,
    averageSuspensionDuration: Math.round(averageHours * 100) / 100,
    mostCommonReason: calculateMostCommonReason(suspensions),
  };
}

function calculateAverageSuspensionHours(
  suspensions: SuspensionStatisticsItem[],
) {
  if (suspensions.length === 0) return 0;
  const totalHours = suspensions.reduce(sumSuspensionDurationHours, 0);
  return totalHours / suspensions.length;
}

function sumSuspensionDurationHours(
  total: number,
  item: SuspensionStatisticsItem,
) {
  if (!item.actual_resume_at) return total;
  return total + calculateSuspensionDurationHours(item);
}

function calculateSuspensionDurationHours(item: SuspensionStatisticsItem) {
  return (
    (item.actual_resume_at!.getTime() - item.suspended_at.getTime()) /
    MILLISECONDS_PER_HOUR
  );
}

function calculateMostCommonReason(
  suspensions: Array<{ reason: string }>,
): string | null {
  const counts = suspensions.reduce<Record<string, number>>(countReason, {});
  const reasons = Object.keys(counts);
  if (reasons.length === 0) return null;
  return reasons.reduce((left, right) =>
    counts[left] > counts[right] ? left : right,
  );
}

function countReason(acc: Record<string, number>, item: { reason: string }) {
  const reason = item.reason || "Unknown";
  return { ...acc, [reason]: (acc[reason] || 0) + 1 };
}

function formatSuspensionItem(item: SuspensionHistoryItem) {
  return {
    ...formatSuspensionIdentity(item),
    ...formatSuspensionTimeline(item),
    resumedBy: item.resumed_by,
    notes: item.notes,
    isActive: item.is_active,
    durationHours: calculateCompletedDurationHours(item),
  };
}

function formatSuspensionIdentity(item: SuspensionHistoryItem) {
  return {
    id: item.id,
    suspensionType: item.suspension_type,
    reason: item.reason,
  };
}

function formatSuspensionTimeline(item: SuspensionHistoryItem) {
  return {
    suspendedAt: item.suspended_at.toISOString(),
    suspendedBy: item.suspended_by,
    expectedResumeAt: item.expected_resume_at?.toISOString() || null,
    actualResumeAt: item.actual_resume_at?.toISOString() || null,
  };
}

function calculateCompletedDurationHours(item: SuspensionHistoryItem) {
  if (!item.actual_resume_at) return null;
  return calculateSuspensionDurationHours(item);
}
