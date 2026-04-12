import type {
  RadiusDashboardStatsViewModel,
  RadiusRecentSessionViewModel,
  RadiusRecentSessionsViewModel,
  RadiusUsageByUsername,
} from "./radius-dashboard.contracts";
import type {
  IDashboardStats,
  IRadiusSessionView,
} from "../../repositories/IRadiusRepository";

function toRoundedTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function toUsageGB(totalUsage: {
  downloadMB: number;
  uploadMB: number;
}): number {
  const totalMB = totalUsage.downloadMB + totalUsage.uploadMB;
  return toRoundedTwoDecimals(totalMB / 1024);
}

export function mapDashboardStats(
  stats: IDashboardStats,
): RadiusDashboardStatsViewModel {
  return {
    totalUsers: stats.totalUsers,
    onlineUsers: stats.onlineUsers,
    offlineUsers: stats.offlineUsers,
    totalTrafficToday: {
      download: stats.totalTrafficToday.download,
      upload: stats.totalTrafficToday.upload,
      downloadGB: stats.totalTrafficToday.downloadGB,
      uploadGB: stats.totalTrafficToday.uploadGB,
    },
    lastSyncTime: stats.lastSyncTime,
    lastSyncStats: {
      created: stats.lastSyncStats.created,
      updated: stats.lastSyncStats.updated,
      deleted: stats.lastSyncStats.deleted,
    },
  };
}

export function mapRecentSession(
  session: IRadiusSessionView,
  totalUsageByUsername: RadiusUsageByUsername,
): RadiusRecentSessionViewModel {
  const usernameKey = session.username?.trim() ?? "";
  const totalUsage = totalUsageByUsername[usernameKey];

  return {
    radAcctId: session.radAcctId,
    username: session.username,
    nasIpAddress: session.nasIpAddress,
    framedIpAddress: session.framedIpAddress,
    acctStartTime: session.acctStartTime,
    acctStopTime: session.acctStopTime,
    acctSessionTime: session.acctSessionTime,
    acctInputOctets: session.acctInputOctets,
    acctOutputOctets: session.acctOutputOctets,
    uptimeSeconds: session.uptimeSeconds,
    uptimeHours: session.uptimeHours,
    downloadMB: session.downloadMB,
    uploadMB: session.uploadMB,
    isOnline: session.isOnline,
    totalUsageGB: totalUsage ? toUsageGB(totalUsage) : 0,
  };
}

export function mapRecentSessions(
  sessions: IRadiusSessionView[],
  totalUsageByUsername: RadiusUsageByUsername,
  pagination: RadiusRecentSessionsViewModel["pagination"],
): RadiusRecentSessionsViewModel {
  return {
    sessions: sessions.map((session) =>
      mapRecentSession(session, totalUsageByUsername),
    ),
    pagination,
  };
}

export function extractUsernames(sessions: IRadiusSessionView[]): string[] {
  return sessions
    .map((session) => session.username)
    .filter((username): username is string => Boolean(username?.trim()));
}

export function normalizeRecentSessionsPagination(
  page: number,
  limit: number,
  total: number,
): RadiusRecentSessionsViewModel["pagination"] {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
