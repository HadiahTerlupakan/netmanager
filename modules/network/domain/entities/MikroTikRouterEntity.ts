export interface MikroTikRouterCreateData {
  name: string;
  ipAddress: string;
  timezone?: string;
  apiPort?: number;
  apiUsername: string;
  apiPassword: string;
  authPort?: number;
  accountingPort?: number;
  secretRadius: string;
  isolirUrl?: string | null;
  description?: string | null;
  siteId?: string | null;
  tenantId: string;
  rosVersion?: "V6" | "V7";
  connectionMode?: "PUBLIC" | "VPN";
  vpnAddress?: string | null;
  vpnCoreRouterId?: string | null;
  vpnActiveServerId?: string | null;
  publicIpAddress?: string | null;
  vpnScriptStale?: boolean;
}

export interface MikroTikRouterUpdateData {
  name?: string;
  ipAddress?: string;
  timezone?: string;
  apiPort?: number;
  apiUsername?: string;
  apiPassword?: string;
  apiUsernameGenerated?: string | null;
  apiPasswordGenerated?: string | null;
  authPort?: number;
  accountingPort?: number;
  secretRadius?: string;
  isolirUrl?: string | null;
  description?: string | null;
  pingStatus?: string;
  userOnline?: number;
  lastStatusCheck?: Date | null;
  siteId?: string | null;
  tenantId?: string;
  rosVersion?: "V6" | "V7";
  connectionMode?: "PUBLIC" | "VPN";
  vpnAddress?: string | null;
  vpnCoreRouterId?: string | null;
  publicIpAddress?: string | null;
  vpnScriptStale?: boolean;
}

export interface MikroTikRouterEntity {
  id: string;
  name: string;
  ipAddress: string;
  connectionMode: "PUBLIC" | "VPN";
  vpnCoreRouterId: string | null;
  timezone: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
  apiUsernameGenerated: string | null;
  apiPasswordGenerated: string | null;
  authPort: number;
  accountingPort: number;
  secretRadius: string;
  isolirUrl: string | null;
  description: string | null;
  pingStatus: string;
  userOnline: number;
  lastStatusCheck: Date | null;
  createdAt: Date;
  updatedAt: Date;
  siteId: string | null;
}

export interface MikroTikRouterStatistics {
  total: number;
  online: number;
  offline: number;
  totalUserOnline: number;
}

export interface RouterFilters {
  search?: string;
  siteId?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedRouterResult {
  routers: (MikroTikRouterEntity & { vpnOnBackup: boolean })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
