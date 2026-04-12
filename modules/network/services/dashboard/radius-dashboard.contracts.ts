export interface RadiusUsageTotals {
  downloadMB: number;
  uploadMB: number;
}

export interface RadiusDashboardStatsViewModel {
  totalUsers: number;
  onlineUsers: number;
  offlineUsers: number;
  totalTrafficToday: {
    download: string;
    upload: string;
    downloadGB: number;
    uploadGB: number;
  };
  lastSyncTime: string;
  lastSyncStats: {
    created: number;
    updated: number;
    deleted: number;
  };
}

export interface RadiusRecentSessionViewModel {
  radAcctId: string;
  username: string | null;
  nasIpAddress: string;
  framedIpAddress: string | null;
  acctStartTime: string | null;
  acctStopTime: string | null;
  acctSessionTime: string;
  acctInputOctets: string;
  acctOutputOctets: string;
  uptimeSeconds: number;
  uptimeHours: number;
  downloadMB: number;
  uploadMB: number;
  isOnline: boolean;
  totalUsageGB: number;
}

export interface RadiusRecentSessionsViewModel {
  sessions: RadiusRecentSessionViewModel[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RadiusDashboardStatsInput {
  tenantId: string;
}

export interface RadiusRecentSessionsInput {
  tenantId: string;
  page: number;
  limit: number;
  status: "active" | "all";
}

export type RadiusUsageByUsername = Record<string, RadiusUsageTotals>;
