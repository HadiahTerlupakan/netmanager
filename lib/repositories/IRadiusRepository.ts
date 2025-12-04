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
    createRadiusUser(data: IRadiusUser): Promise<void>;
    updateRadiusPassword(username: string, password: string): Promise<void>;
    deleteRadiusUser(username: string): Promise<void>;
    userExists(username: string): Promise<boolean>;

    // Bandwidth Management
    setUserBandwidth(username: string, bandwidth: IRadiusBandwidth): Promise<void>;
    getUserBandwidth(username: string): Promise<IRadiusBandwidth | null>;

    // Group Management
    assignUserToGroup(username: string, groupname: string, priority?: number): Promise<void>;
    removeUserFromGroup(username: string, groupname: string): Promise<void>;
    getUserGroups(username: string): Promise<string[]>;

    // Session Management
    getActiveSessions(username?: string): Promise<IRadiusSession[]>;
    getUserSessions(username: string, startDate?: Date, endDate?: Date): Promise<IRadiusSession[]>;

    // Accounting Stats
    getAccountingStats(username: string, startDate?: Date, endDate?: Date): Promise<IRadiusAccountingStats>;

    // Sync Operations
    syncPelangganToRadius(pelangganId: string): Promise<void>;
    syncAllActiveCustomers(): Promise<{ created: number; updated: number; deleted: number }>;

    // NAS Management
    createNas(nas: INas): Promise<INas>;
    updateNas(id: number, nas: Partial<INas>): Promise<INas>;
    deleteNas(id: number): Promise<void>;
    getNasById(id: number): Promise<INas | null>;
    getAllNas(): Promise<INas[]>;
    getNasByIp(ip: string): Promise<INas | null>;

    // IP Pool Management
    addToIpPool(pool: IRadIpPool): Promise<IRadIpPool>;
    removeFromIpPool(ipAddress: string): Promise<void>;
    getIpFromPool(poolName: string, nasIpAddress?: string): Promise<string | null>;
    returnIpToPool(ipAddress: string): Promise<void>;
    getIpPoolStats(poolName?: string): Promise<{ total: number; used: number; available: number }>;
    getAllIpPools(): Promise<IRadIpPool[]>;
}
