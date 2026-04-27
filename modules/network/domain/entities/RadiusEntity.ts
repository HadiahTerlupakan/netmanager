export interface RadiusUserEntity {
  username: string;
  password: string;
  groupname?: string;
}

export interface RadiusBandwidthEntity {
  downloadMbps: number;
  uploadMbps: number;
}

export interface RadiusSessionEntity {
  radAcctId: bigint;
  username: string | null;
  acctSessionId: string;
  acctUniqueId: string;
  nasIpAddress: string;
  acctStartTime: Date | null;
  acctStopTime: Date | null;
  acctSessionTime: bigint | null;
  acctInputOctets: bigint | null;
  acctOutputOctets: bigint | null;
  framedIpAddress: string | null;
}

export interface RadiusAccountingStatsEntity {
  username: string;
  totalSessions: number;
  totalSessionTime: bigint;
  totalInputOctets: bigint;
  totalOutputOctets: bigint;
  activeSessions: number;
}

export interface NasEntity {
  id?: number;
  nasname: string;
  shortname?: string;
  type?: string;
  ports?: number;
  secret: string;
  community?: string;
  description?: string;
}

export interface RadIpPoolEntity {
  id?: number;
  poolName: string;
  framedIpAddress: string;
  nasIpAddress?: string;
  poolKey?: string;
}

export interface DashboardStatsEntity {
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

export interface RadiusSessionViewEntity {
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
}

export interface RadiusSessionHistoryItemEntity {
  radAcctId: string;
  username: string | null;
  nasIpAddress: string;
  framedIpAddress: string | null;
  acctStartTime: string | null;
  acctStopTime: string | null;
  acctSessionTime: string;
  acctInputOctets: string;
  acctOutputOctets: string;
  totalOctets: string;
  uploadMB: number;
  downloadMB: number;
  totalMB: number;
  isOnline: boolean;
}

export interface RadiusSessionHistorySummaryEntity {
  totalSessions: number;
  activeSessions: number;
  totalSessionTime: string;
  totalInputOctets: string;
  totalOutputOctets: string;
  totalOctets: string;
  totalInputMB: number;
  totalOutputMB: number;
  totalMB: number;
}

export interface RadiusSessionHistoryResultEntity {
  sessions: RadiusSessionHistoryItemEntity[];
  total: number;
  summary: RadiusSessionHistorySummaryEntity;
}

export interface RadiusSessionHistoryOptionsEntity {
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface RadiusSessionTotalsEntity {
  downloadMB: number;
  uploadMB: number;
}
