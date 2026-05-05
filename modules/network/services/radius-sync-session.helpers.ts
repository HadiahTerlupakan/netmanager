import type {
  RadiusSessionHistoryItemEntity,
  RadiusSessionHistoryResultEntity,
  RadiusSessionHistorySummaryEntity,
} from "../domain/entities/RadiusEntity";

type SessionHistoryParams = {
  page?: number;
  limit?: number;
  startDate?: string | null;
  endDate?: string | null;
};

const DEFAULT_HISTORY_PAGE = 1;
const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;
const ROUNDING_FACTOR = 100;
const SECONDS_PER_HOUR = 3600;
const MB_PER_GB = 1024;
const OCTETS_PER_GB = 1073741824;

function roundToTwoDecimals(value: number): number {
  return Math.round(value * ROUNDING_FACTOR) / ROUNDING_FACTOR;
}

function parseHistoryDateParam(
  value: string | null,
  endOfDay = false,
): Date | undefined {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (!endOfDay) return date;

  return toISODateEnd(date);
}

export function toISODateEnd(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function toHours(seconds: string | number): number {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return roundToTwoDecimals(value / SECONDS_PER_HOUR);
}

export function toGBFromMB(mb: string | number): number {
  const value = Number(mb || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return roundToTwoDecimals(value / MB_PER_GB);
}

export function toMB(bytes: string | number, divisor: number): number {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return roundToTwoDecimals(value / divisor);
}

export function toGBFromOctets(octets: string | number): number {
  return toMB(octets, OCTETS_PER_GB);
}

export function buildSessionHistoryOptions(params: SessionHistoryParams) {
  const page =
    params.page && params.page > 0 ? params.page : DEFAULT_HISTORY_PAGE;
  const limit =
    params.limit && params.limit > 0
      ? Math.min(params.limit, MAX_HISTORY_LIMIT)
      : DEFAULT_HISTORY_LIMIT;
  const startDate = parseHistoryDateParam(params.startDate ?? null);
  const endDate = parseHistoryDateParam(params.endDate ?? null, true);

  return {
    page,
    limit,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
}

type SessionHistoryViewItem = RadiusSessionHistoryItemEntity & {
  acctSessionHours: number;
  uploadGB: number;
  downloadGB: number;
  totalGB: number;
};

type SessionHistoryViewSummary = RadiusSessionHistorySummaryEntity & {
  totalSessionHours: number;
  totalInputGB: number;
  totalOutputGB: number;
  totalGB: number;
};

export function buildSessionHistoryView(
  username: string,
  result: RadiusSessionHistoryResultEntity,
  pagination: { page: number; limit: number },
): {
  username: string;
  summary: SessionHistoryViewSummary;
  sessions: SessionHistoryViewItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
} {
  const sessions: SessionHistoryViewItem[] = result.sessions.map((item) => ({
    ...item,
    acctSessionHours: toHours(item.acctSessionTime),
    uploadGB: toGBFromMB(item.uploadMB),
    downloadGB: toGBFromMB(item.downloadMB),
    totalGB: toGBFromMB(item.totalMB),
  }));

  const summary: SessionHistoryViewSummary = {
    ...result.summary,
    totalSessionHours: toHours(result.summary.totalSessionTime),
    totalInputGB: toGBFromOctets(result.summary.totalInputOctets),
    totalOutputGB: toGBFromOctets(result.summary.totalOutputOctets),
    totalGB: toGBFromOctets(result.summary.totalOctets),
  };

  return {
    username,
    summary,
    sessions,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / pagination.limit),
    },
  };
}
