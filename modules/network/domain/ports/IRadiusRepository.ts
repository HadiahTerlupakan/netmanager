import type {
  DashboardStatsEntity,
  NasEntity,
  RadIpPoolEntity,
  RadiusAccountingStatsEntity,
  RadiusBandwidthEntity,
  RadiusSessionEntity,
  RadiusSessionHistoryOptionsEntity,
  RadiusSessionHistoryResultEntity,
  RadiusSessionTotalsEntity,
  RadiusSessionViewEntity,
  RadiusUserEntity,
} from "../entities/RadiusEntity";

export interface IRadiusRepository {
  /** Create a RADIUS user with credentials. */
  createRadiusUser(data: RadiusUserEntity, tenantId: string): Promise<void>;

  /** Update a RADIUS user password. */
  updateRadiusPassword(
    username: string,
    password: string,
    tenantId: string,
  ): Promise<void>;

  /** Delete a RADIUS user and related records. */
  deleteRadiusUser(username: string, tenantId: string): Promise<void>;

  /** Check whether a RADIUS user exists. */
  userExists(username: string, tenantId: string): Promise<boolean>;

  /** Set bandwidth for one user. */
  setUserBandwidth(
    username: string,
    bandwidth: RadiusBandwidthEntity,
    tenantId: string,
  ): Promise<void>;

  /** Get bandwidth for one user. */
  getUserBandwidth(
    username: string,
    tenantId: string,
  ): Promise<RadiusBandwidthEntity | null>;

  /** Set bandwidth for one group. */
  setGroupBandwidth(
    groupname: string,
    bandwidth: string | RadiusBandwidthEntity,
    tenantId: string,
  ): Promise<void>;

  /** Get bandwidth for one group. */
  getGroupBandwidth(
    groupname: string,
    tenantId: string,
  ): Promise<RadiusBandwidthEntity | null>;

  /** Set one group reply attribute. */
  setGroupAttribute(
    groupname: string,
    attribute: string,
    value: string,
    tenantId: string,
    op?: string,
  ): Promise<void>;

  /** Remove one group reply attribute. */
  removeGroupAttribute(
    groupname: string,
    attribute: string,
    tenantId: string,
  ): Promise<void>;

  /** Set one group check attribute. */
  setGroupCheckAttribute(
    groupname: string,
    attribute: string,
    value: string,
    tenantId: string,
    op?: string,
  ): Promise<void>;

  /** Remove one group check attribute. */
  removeGroupCheckAttribute(
    groupname: string,
    attribute: string,
    tenantId: string,
  ): Promise<void>;

  /** Assign a user to a group. */
  assignUserToGroup(
    username: string,
    groupname: string,
    tenantId: string,
    priority?: number,
  ): Promise<void>;

  /** Remove a user from a group. */
  removeUserFromGroup(
    username: string,
    groupname: string,
    tenantId: string,
  ): Promise<void>;

  /** Get group names assigned to a user. */
  getUserGroups(username: string, tenantId: string): Promise<string[]>;

  /** Get active sessions for a tenant. */
  getActiveSessions(
    tenantId: string,
    username?: string,
  ): Promise<RadiusSessionEntity[]>;

  /** Get session history for a user. */
  getUserSessions(
    username: string,
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<RadiusSessionEntity[]>;

  /** Get accounting stats for a user. */
  getAccountingStats(
    username: string,
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<RadiusAccountingStatsEntity>;

  /** Sync one pelanggan into RADIUS. */
  syncPelangganToRadius(pelangganId: string): Promise<void>;

  /** Sync all active customers into RADIUS. */
  syncAllActiveCustomers(
    tenantId?: string,
  ): Promise<{ created: number; updated: number; deleted: number }>;

  /** Sync one package into RADIUS. */
  syncPackageToRadius(packageId: string): Promise<void>;

  /** Sync one bandwidth into RADIUS. */
  syncBandwidthToRadius(bandwidthId: string): Promise<void>;

  /** Sync one PPP profile into RADIUS. */
  syncProfileToRadius(profileId: string): Promise<void>;

  /** Sync all packages into RADIUS. */
  syncAllPackagesToRadius(tenantId?: string): Promise<void>;

  /** Sync one IP pool into RADIUS. */
  syncIpPoolToRadius(
    poolName: string,
    ipRange: string,
    tenantId: string,
  ): Promise<void>;

  /** Create or upsert one NAS entity. */
  createNas(nas: NasEntity, tenantId: string): Promise<NasEntity>;

  /** Update one NAS entity. */
  updateNas(
    id: number,
    nas: Partial<NasEntity>,
    tenantId: string,
  ): Promise<NasEntity>;

  /** Delete one NAS entity. */
  deleteNas(id: number, tenantId: string): Promise<void>;

  /** Get NAS by id. */
  getNasById(id: number, tenantId: string): Promise<NasEntity | null>;

  /** Get all NAS entities for a tenant. */
  getAllNas(tenantId: string): Promise<NasEntity[]>;

  /** Get NAS by IP. */
  getNasByIp(ip: string, tenantId: string): Promise<NasEntity | null>;

  /** Add an IP into a pool. */
  addToIpPool(
    pool: RadIpPoolEntity,
    tenantId: string,
  ): Promise<RadIpPoolEntity>;

  /** Remove an IP from a pool. */
  removeFromIpPool(ipAddress: string, tenantId: string): Promise<void>;

  /** Get one available IP from a pool. */
  getIpFromPool(
    poolName: string,
    tenantId: string,
    nasIpAddress?: string,
  ): Promise<string | null>;

  /** Return one IP to a pool. */
  returnIpToPool(ipAddress: string, tenantId: string): Promise<void>;

  /** Get pool statistics. */
  getIpPoolStats(
    tenantId: string,
    poolName?: string,
  ): Promise<{ total: number; used: number; available: number }>;

  /** Get all IP pools for a tenant. */
  getAllIpPools(tenantId: string): Promise<RadIpPoolEntity[]>;

  /** Get dashboard stats for one tenant. */
  getDashboardStats(tenantId: string): Promise<DashboardStatsEntity>;

  /** Get recent session views with pagination. */
  getRecentSessions(
    tenantId: string,
    options?: { page?: number; limit?: number; status?: "active" | "all" },
  ): Promise<{ sessions: RadiusSessionViewEntity[]; total: number }>;

  /** Aggregate total usage by usernames. */
  getTotalUsageByUsernames(
    tenantId: string,
    usernames: string[],
  ): Promise<Record<string, RadiusSessionTotalsEntity>>;

  /** Get session history view for one user. */
  getUserSessionHistory(
    tenantId: string,
    username: string,
    options?: RadiusSessionHistoryOptionsEntity,
  ): Promise<RadiusSessionHistoryResultEntity>;
}
