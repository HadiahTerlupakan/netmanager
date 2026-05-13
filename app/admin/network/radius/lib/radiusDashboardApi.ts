import { z } from "zod";

import { fetchDashboardResource } from "@/lib/dashboard/fetchDashboardResource";
import type {
  RadiusDashboardStatsViewModel,
  RadiusRecentSessionViewModel,
  RadiusRecentSessionsViewModel,
} from "@/modules/network";
import { RADIUS_API, RADIUS_CONSTANTS } from "../constants";

const radiusDashboardStatsSchema: z.ZodType<RadiusDashboardStatsViewModel> =
  z.object({
    totalUsers: z.number(),
    onlineUsers: z.number(),
    offlineUsers: z.number(),
    totalTrafficToday: z.object({
      download: z.string(),
      upload: z.string(),
      downloadGB: z.number(),
      uploadGB: z.number(),
    }),
    lastSyncTime: z.string(),
    lastSyncStats: z.object({
      created: z.number(),
      updated: z.number(),
      deleted: z.number(),
    }),
  });

const radiusRecentSessionResponseSchema = z.object({
  radAcctId: z.string(),
  username: z.string().nullable(),
  nasIpAddress: z.string(),
  framedIpAddress: z.string().nullable(),
  acctStartTime: z.string().nullable(),
  acctStopTime: z.string().nullable(),
  acctSessionTime: z.string(),
  acctInputOctets: z.string(),
  acctOutputOctets: z.string(),
  uptimeSeconds: z.number(),
  uptimeHours: z.number(),
  downloadMB: z.number(),
  uploadMB: z.number(),
  isOnline: z.boolean(),
  totalUsageGB: z.number(),
});

type RadiusRecentSessionResponse = z.infer<
  typeof radiusRecentSessionResponseSchema
>;

const radiusRecentSessionsResponseSchema = z.object({
  sessions: z.array(radiusRecentSessionResponseSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

type RadiusRecentSessionsResponse = z.infer<
  typeof radiusRecentSessionsResponseSchema
>;

function mapRecentSessionResponse(
  session: RadiusRecentSessionResponse,
): RadiusRecentSessionViewModel {
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
    totalUsageGB: session.totalUsageGB,
  };
}

function mapRecentSessionsResponse(
  response: RadiusRecentSessionsResponse,
): RadiusRecentSessionsViewModel {
  return {
    sessions: response.sessions.map(mapRecentSessionResponse),
    pagination: response.pagination,
  };
}

interface RadiusSessionHistorySummary {
  totalSessions: number;
  activeSessions: number;
  totalSessionTime: string;
  totalSessionHours: number;
  totalInputOctets: string;
  totalOutputOctets: string;
  totalOctets: string;
  totalInputMB: number;
  totalOutputMB: number;
  totalMB: number;
  totalInputGB: number;
  totalOutputGB: number;
  totalGB: number;
}

interface RadiusSessionHistoryItem {
  radAcctId: string;
  username: string | null;
  nasIpAddress: string;
  framedIpAddress: string | null;
  acctStartTime: string | null;
  acctStopTime: string | null;
  acctSessionTime: string;
  acctSessionHours: number;
  acctInputOctets: string;
  acctOutputOctets: string;
  totalOctets: string;
  uploadMB: number;
  downloadMB: number;
  totalMB: number;
  uploadGB: number;
  downloadGB: number;
  totalGB: number;
  isOnline: boolean;
}

export interface RadiusSessionHistoryData {
  username: string;
  summary: RadiusSessionHistorySummary;
  sessions: RadiusSessionHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  period?: {
    startDate?: string | null;
    endDate?: string | null;
  };
}

const radiusSessionHistorySummarySchema = z.object({
  totalSessions: z.number(),
  activeSessions: z.number(),
  totalSessionTime: z.string(),
  totalSessionHours: z.number(),
  totalInputOctets: z.string(),
  totalOutputOctets: z.string(),
  totalOctets: z.string(),
  totalInputMB: z.number(),
  totalOutputMB: z.number(),
  totalMB: z.number(),
  totalInputGB: z.number(),
  totalOutputGB: z.number(),
  totalGB: z.number(),
});

const radiusSessionHistoryItemSchema = z.object({
  radAcctId: z.string(),
  username: z.string().nullable(),
  nasIpAddress: z.string(),
  framedIpAddress: z.string().nullable(),
  acctStartTime: z.string().nullable(),
  acctStopTime: z.string().nullable(),
  acctSessionTime: z.string(),
  acctSessionHours: z.number(),
  acctInputOctets: z.string(),
  acctOutputOctets: z.string(),
  totalOctets: z.string(),
  uploadMB: z.number(),
  downloadMB: z.number(),
  totalMB: z.number(),
  uploadGB: z.number(),
  downloadGB: z.number(),
  totalGB: z.number(),
  isOnline: z.boolean(),
});

const radiusSessionHistorySchema = z.object({
  username: z.string(),
  summary: radiusSessionHistorySummarySchema,
  sessions: z.array(radiusSessionHistoryItemSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
  period: z
    .object({
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
    })
    .optional(),
}) as z.ZodType<RadiusSessionHistoryData>;

export type RadiusResetResult = {
  username: string;
  disconnected: number;
  pelangganId?: string;
};

export type RadiusForceDeleteResult = {
  deleted: number;
};

export interface RadiusDashboardApi {
  getStats: () => Promise<RadiusDashboardStatsViewModel>;
  getRecentSessions: () => Promise<RadiusRecentSessionsViewModel>;
  getHistory: (input: {
    username: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) => Promise<RadiusSessionHistoryData>;
  resetConnection: (username: string) => Promise<RadiusResetResult>;
  forceDeleteUser: (username: string) => Promise<RadiusForceDeleteResult>;
}

function buildRecentSessionsUrl(): string {
  return `${RADIUS_API.RECENT_SESSIONS}?status=active&limit=${RADIUS_CONSTANTS.RECENT_SESSIONS_LIMIT}`;
}

function buildHistoryUrl(input: {
  username: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}): string {
  const params = new URLSearchParams({
    page: String(input.page ?? RADIUS_CONSTANTS.HISTORY_PAGE_DEFAULT),
    limit: String(input.limit ?? RADIUS_CONSTANTS.HISTORY_LIMIT_DEFAULT),
  });

  if (input.startDate) params.set("startDate", input.startDate);
  if (input.endDate) params.set("endDate", input.endDate);

  return `${RADIUS_API.SESSION_HISTORY(input.username)}?${params.toString()}`;
}

function buildResetRequestBody(username: string): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  };
}

const radiusResetResultSchema = z.object({
  username: z.string(),
  disconnected: z.number(),
  pelangganId: z.string().optional(),
}) satisfies z.ZodType<RadiusResetResult>;

const radiusForceDeleteResultSchema = z.object({
  deleted: z.number(),
}) satisfies z.ZodType<RadiusForceDeleteResult>;

/**
 * Create typed dashboard API for RADIUS dashboard consumers.
 */
export function createRadiusDashboardApi(): RadiusDashboardApi {
  return {
    getStats: async () =>
      fetchDashboardResource(RADIUS_API.STATS, radiusDashboardStatsSchema),
    getRecentSessions: async () => {
      const response = await fetchDashboardResource(
        buildRecentSessionsUrl(),
        radiusRecentSessionsResponseSchema,
      );

      return mapRecentSessionsResponse(response);
    },
    getHistory: async (input) =>
      fetchDashboardResource(
        buildHistoryUrl(input),
        radiusSessionHistorySchema,
      ),
    resetConnection: async (username) =>
      fetchDashboardResource(
        RADIUS_API.RESET_CONNECTION,
        radiusResetResultSchema,
        buildResetRequestBody(username),
      ),
    forceDeleteUser: async (username) =>
      fetchDashboardResource(
        RADIUS_API.FORCE_DELETE_USER(username),
        radiusForceDeleteResultSchema,
        { method: "DELETE" },
      ),
  };
}
