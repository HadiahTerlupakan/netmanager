import type { RadiusSyncService } from "@/modules/network";

import type {
  PeriodType,
  UsageCustomerRecord,
} from "./pelanggan-ppp-route-helpers";

const BYTES_PER_GB = 1073741824;
const SECONDS_PER_HOUR = 3600;

type DatabaseUsageStats = {
  totalSessionTime: bigint;
  totalUploadBytes: bigint;
  totalDownloadBytes: bigint;
  totalBytes: bigint;
  sessionCount: number;
};

export type UsageSummaryResponseInput = {
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
  dbStats: DatabaseUsageStats;
};

export function buildUsageSummaryResponse(input: UsageSummaryResponseInput) {
  return {
    success: true,
    customer: buildUsageCustomer(input.pelanggan),
    period: buildUsagePeriod(input),
    usage: buildUsageSummaryStats(input),
    activeSession: buildActiveSessionSummary(input.activeSession),
  };
}

function buildUsagePeriod(input: UsageSummaryResponseInput) {
  return {
    type: input.periodType,
    startDate: input.periodRange.startDate.toISOString(),
    endDate: input.periodRange.endDate.toISOString(),
  };
}

function buildUsageSummaryStats(input: UsageSummaryResponseInput) {
  const totalInput = Number(input.radiusStats.totalInputOctets);
  const totalOutput = Number(input.radiusStats.totalOutputOctets);
  return {
    ...buildRadiusUsageStats(input, totalInput, totalOutput),
    ...buildDatabaseUsageStats(input),
  };
}

function buildRadiusUsageStats(
  input: UsageSummaryResponseInput,
  totalInput: number,
  totalOutput: number,
) {
  return {
    totalSessions: input.radiusStats.totalSessions,
    totalSessionTime: input.radiusStats.totalSessionTime.toString(),
    totalInputOctets: input.radiusStats.totalInputOctets.toString(),
    totalOutputOctets: input.radiusStats.totalOutputOctets.toString(),
    activeSessions: input.radiusStats.activeSessions,
    totalSessionTimeHours: toHours(input.radiusStats.totalSessionTime),
    totalInputGB: totalInput / BYTES_PER_GB,
    totalOutputGB: totalOutput / BYTES_PER_GB,
    totalGB: (totalInput + totalOutput) / BYTES_PER_GB,
  };
}

function buildDatabaseUsageStats(input: UsageSummaryResponseInput) {
  return {
    dbSessionCount: input.dbStats.sessionCount,
    dbTotalSessionTime: input.dbStats.totalSessionTime.toString(),
    dbTotalUploadBytes: input.dbStats.totalUploadBytes.toString(),
    dbTotalDownloadBytes: input.dbStats.totalDownloadBytes.toString(),
    dbTotalBytes: input.dbStats.totalBytes.toString(),
    dbTotalSessionTimeHours: toHours(input.dbStats.totalSessionTime),
    dbTotalUploadGB: Number(input.dbStats.totalUploadBytes) / BYTES_PER_GB,
    dbTotalDownloadGB: Number(input.dbStats.totalDownloadBytes) / BYTES_PER_GB,
    dbTotalGB: Number(input.dbStats.totalBytes) / BYTES_PER_GB,
  };
}

function buildActiveSessionSummary(
  activeSession: UsageSummaryResponseInput["activeSession"],
) {
  if (!activeSession) return null;
  return {
    sessionId: activeSession.acctSessionId,
    startTime: activeSession.acctStartTime?.toISOString(),
    nasIpAddress: activeSession.nasIpAddress,
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

function toHours(value: bigint) {
  return Number(value) / SECONDS_PER_HOUR;
}
