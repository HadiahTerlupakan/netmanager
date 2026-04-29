import type {
  RadiusSessionHistoryItemEntity,
  RadiusSessionHistoryOptionsEntity,
  RadiusSessionHistoryResultEntity,
  RadiusSessionHistorySummaryEntity,
} from "../domain/entities/RadiusEntity";
import {
  BYTES_PER_GB,
  BYTES_PER_MB,
  DEFAULT_RECENT_SESSION_LIMIT,
  DEFAULT_SESSION_LIMIT,
  DEFAULT_SESSION_PAGE,
  ONE_SECOND_IN_MS,
  PERCENT_PRECISION,
} from "./radiusRepository.constants";

/** Parse MikroTik speed string into Mbps. */
export function parseRadiusSpeed(speed: string | null): number {
  if (!speed) return 0;

  const match = speed.match(/^(\d+)([MKG])?$/i);
  if (!match) return 0;

  const value = parseInt(match[1] ?? "0", 10);
  const unit = match[2]?.toUpperCase();
  if (unit === "G") return value * 1000;
  if (unit === "M") return value;
  if (unit === "K") return value / 1000;
  return value;
}

/** Detect whether IP pool entry is currently allocated. */
export function isAllocatedIpPoolEntry(entry: {
  nasipaddress: string;
  pool_key: string;
  username: string;
  callingstationid: string;
  calledstationid: string;
}): boolean {
  return Boolean(
    entry.nasipaddress ||
    entry.pool_key ||
    entry.username ||
    entry.callingstationid ||
    entry.calledstationid,
  );
}

/** Build history query filter from tenant, username, and date options. */
export function buildSessionHistoryWhereClause(
  tenantId: string,
  username: string,
  options: RadiusSessionHistoryOptionsEntity,
) {
  const { startDate, endDate } = options;

  if (!startDate && !endDate) {
    return { tenantId, username };
  }

  return {
    tenantId,
    username,
    acctstarttime: {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    },
  };
}

interface RawHistorySessionRecord {
  radacctid: bigint | number;
  username: string | null;
  nasipaddress: string;
  framedipaddress: string | null;
  acctstarttime: Date | null;
  acctstoptime: Date | null;
  acctsessiontime: bigint | number | null;
  acctinputoctets: bigint | number | null;
  acctoutputoctets: bigint | number | null;
}

interface RawHistorySummaryRecord {
  _count: { _all: number };
  _sum: {
    acctsessiontime: bigint | number | null;
    acctinputoctets: bigint | number | null;
    acctoutputoctets: bigint | number | null;
  };
}

/** Build paginated history result from raw aggregate and session rows. */
export function buildSessionHistoryResult(params: {
  total: number;
  sessions: RawHistorySessionRecord[];
  summaryRaw: RawHistorySummaryRecord;
}): RadiusSessionHistoryResultEntity {
  const { total, sessions, summaryRaw } = params;
  const items = sessions.map(toHistoryItem);
  const summary = buildHistorySummary(summaryRaw, items);
  return { sessions: items, total, summary };
}

/** Build default pagination values for session history. */
export function getSessionHistoryPagination(
  options: RadiusSessionHistoryOptionsEntity,
) {
  const page = options.page ?? DEFAULT_SESSION_PAGE;
  const limit = options.limit ?? DEFAULT_SESSION_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
}

/** Build pagination values for recent sessions. */
export function getRecentSessionPagination(options: {
  page?: number;
  limit?: number;
}) {
  const page = options.page ?? DEFAULT_SESSION_PAGE;
  const limit = options.limit ?? DEFAULT_RECENT_SESSION_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
}

/** Convert bigint traffic total into rounded gigabytes. */
export function toRoundedGigabytes(totalBytes: bigint): number {
  const gigabytes = Number(totalBytes) / BYTES_PER_GB;
  return Math.round(gigabytes * PERCENT_PRECISION) / PERCENT_PRECISION;
}

/** Get a past timestamp for expired pool entries. */
export function getExpiredPoolTimestamp(): Date {
  return new Date(Date.now() - ONE_SECOND_IN_MS);
}

function toHistoryItem(
  session: RawHistorySessionRecord,
): RadiusSessionHistoryItemEntity {
  const inputOctets = BigInt(session.acctinputoctets ?? 0);
  const outputOctets = BigInt(session.acctoutputoctets ?? 0);
  const totalOctets = inputOctets + outputOctets;

  return {
    radAcctId: session.radacctid.toString(),
    username: session.username,
    nasIpAddress: session.nasipaddress,
    framedIpAddress: session.framedipaddress,
    acctStartTime: session.acctstarttime?.toISOString() || null,
    acctStopTime: session.acctstoptime?.toISOString() || null,
    acctSessionTime: session.acctsessiontime?.toString() || "0",
    acctInputOctets: inputOctets.toString(),
    acctOutputOctets: outputOctets.toString(),
    totalOctets: totalOctets.toString(),
    uploadMB: toRoundedMegabytes(inputOctets),
    downloadMB: toRoundedMegabytes(outputOctets),
    totalMB: toRoundedMegabytes(totalOctets),
    isOnline: session.acctstoptime === null,
  };
}

function buildHistorySummary(
  summaryRaw: RawHistorySummaryRecord,
  items: RadiusSessionHistoryItemEntity[],
): RadiusSessionHistorySummaryEntity {
  const totalInputOctets = BigInt(summaryRaw._sum.acctinputoctets ?? 0);
  const totalOutputOctets = BigInt(summaryRaw._sum.acctoutputoctets ?? 0);
  const totalSessionTime = BigInt(summaryRaw._sum.acctsessiontime ?? 0);
  const totalOctets = totalInputOctets + totalOutputOctets;

  return {
    totalSessions: summaryRaw._count._all,
    activeSessions: items.filter((item) => item.isOnline).length,
    totalSessionTime: totalSessionTime.toString(),
    totalInputOctets: totalInputOctets.toString(),
    totalOutputOctets: totalOutputOctets.toString(),
    totalOctets: totalOctets.toString(),
    totalInputMB: toRoundedMegabytes(totalInputOctets),
    totalOutputMB: toRoundedMegabytes(totalOutputOctets),
    totalMB: toRoundedMegabytes(totalOctets),
  };
}

function toRoundedMegabytes(totalBytes: bigint): number {
  const megabytes = Number(totalBytes) / BYTES_PER_MB;
  return Math.round(megabytes * PERCENT_PRECISION) / PERCENT_PRECISION;
}
