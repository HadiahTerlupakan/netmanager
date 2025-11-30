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
}
