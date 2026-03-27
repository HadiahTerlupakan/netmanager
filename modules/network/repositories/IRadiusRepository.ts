/**
 * RADIUS Repository Interface
 * 
 * Manages FreeRADIUS database operations for authentication, authorization, and accounting.
 */

export interface IRadiusUser {
    username: string;
    password: string;
    groupname?: string;
}

export interface IRadiusBandwidth {
    downloadMbps: number;
    uploadMbps: number;
}

export interface IRadiusSession {
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

export interface IRadiusAccountingStats {
    username: string;
    totalSessions: number;
    totalSessionTime: bigint;
    totalInputOctets: bigint;
    totalOutputOctets: bigint;
    activeSessions: number;
}

export interface INas {
    id?: number;
    nasname: string;
    shortname?: string;
    type?: string;
    ports?: number;
    secret: string;
    community?: string;
    description?: string;
}

export interface IRadIpPool {
    id?: number;
    poolName: string;
    framedIpAddress: string;
    nasIpAddress?: string;
    poolKey?: string;
}

export interface IRadiusRepository {
    // User Management
    createRadiusUser(data: IRadiusUser, tenantId: string): Promise<void>;
    updateRadiusPassword(username: string, password: string, tenantId: string): Promise<void>;
    deleteRadiusUser(username: string, tenantId: string): Promise<void>;
    userExists(username: string, tenantId: string): Promise<boolean>;

    // Bandwidth Management
    setUserBandwidth(username: string, bandwidth: IRadiusBandwidth, tenantId: string): Promise<void>;
    getUserBandwidth(username: string, tenantId: string): Promise<IRadiusBandwidth | null>;
    setGroupBandwidth(groupname: string, bandwidth: IRadiusBandwidth, tenantId: string): Promise<void>;
    getGroupBandwidth(groupname: string, tenantId: string): Promise<IRadiusBandwidth | null>;
    setGroupAttribute(groupname: string, attribute: string, value: string, tenantId: string, op?: string): Promise<void>;
    removeGroupAttribute(groupname: string, attribute: string, tenantId: string): Promise<void>;
    setGroupCheckAttribute(groupname: string, attribute: string, value: string, tenantId: string, op?: string): Promise<void>;
    removeGroupCheckAttribute(groupname: string, attribute: string, tenantId: string): Promise<void>;

    // Group Management
    assignUserToGroup(username: string, groupname: string, tenantId: string, priority?: number): Promise<void>;
    removeUserFromGroup(username: string, groupname: string, tenantId: string): Promise<void>;
    getUserGroups(username: string, tenantId: string): Promise<string[]>;

    // Session Management
    getActiveSessions(tenantId: string, username?: string): Promise<IRadiusSession[]>;
    getUserSessions(username: string, tenantId: string, startDate?: Date, endDate?: Date): Promise<IRadiusSession[]>;

    // Accounting Stats
    getAccountingStats(username: string, tenantId: string, startDate?: Date, endDate?: Date): Promise<IRadiusAccountingStats>;

    // Sync Operations
    syncPelangganToRadius(pelangganId: string): Promise<void>;
    syncAllActiveCustomers(tenantId?: string): Promise<{ created: number; updated: number; deleted: number }>;
    syncPackageToRadius(packageId: string): Promise<void>;
    syncBandwidthToRadius(bandwidthId: string): Promise<void>;
    syncProfileToRadius(profileId: string): Promise<void>;
    syncAllPackagesToRadius(tenantId?: string): Promise<void>;
    syncIpPoolToRadius(poolName: string, ipRange: string, tenantId: string): Promise<void>;

    // NAS Management
    createNas(nas: INas, tenantId: string): Promise<INas>;
    updateNas(id: number, nas: Partial<INas>, tenantId: string): Promise<INas>;
    deleteNas(id: number, tenantId: string): Promise<void>;
    getNasById(id: number, tenantId: string): Promise<INas | null>;
    getAllNas(tenantId: string): Promise<INas[]>;
    getNasByIp(ip: string, tenantId: string): Promise<INas | null>;

    // IP Pool Management
    addToIpPool(pool: IRadIpPool, tenantId: string): Promise<IRadIpPool>;
    removeFromIpPool(ipAddress: string, tenantId: string): Promise<void>;
    getIpFromPool(poolName: string, tenantId: string, nasIpAddress?: string): Promise<string | null>;
    returnIpToPool(ipAddress: string, tenantId: string): Promise<void>;
    getIpPoolStats(tenantId: string, poolName?: string): Promise<{ total: number; used: number; available: number }>;
    getAllIpPools(tenantId: string): Promise<IRadIpPool[]>;
    // Dashboard Methods
    getDashboardStats(tenantId: string): Promise<IDashboardStats>;
    getRecentSessions(tenantId: string, options?: {
        page?: number;
        limit?: number;
        status?: 'active' | 'all';
    }): Promise<{ sessions: IRadiusSessionView[]; total: number }>;
}

export interface IDashboardStats {
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

export interface IRadiusSessionView {
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
