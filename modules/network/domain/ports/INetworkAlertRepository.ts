import type {
  NetworkAlertCreateData,
  NetworkAlertEntity,
  NetworkAlertFilters,
  NetworkAlertUpdateData,
} from "../entities/NetworkAlertEntity";

export interface INetworkAlertRepository {
  /** Create one network alert. */
  create(data: NetworkAlertCreateData): Promise<NetworkAlertEntity>;

  /** Get one network alert by id. */
  findById(id: string): Promise<NetworkAlertEntity | null>;

  /** Get network alerts by filters. */
  findMany(
    filters?: NetworkAlertFilters,
  ): Promise<{
    data: NetworkAlertEntity[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>;

  /** Update one network alert. */
  update(id: string, data: NetworkAlertUpdateData): Promise<NetworkAlertEntity>;

  /** Mark one network alert as acknowledged. */
  acknowledge(id: string, userId: string): Promise<NetworkAlertEntity>;

  /** Mark one network alert as resolved. */
  resolve(id: string, userId: string): Promise<NetworkAlertEntity>;

  /** Delete one network alert by id. */
  delete(id: string): Promise<NetworkAlertEntity>;

  /** Get active alerts by optional device scope. */
  getActiveAlerts(
    deviceId?: string,
    deviceType?: string,
  ): Promise<NetworkAlertEntity[]>;

  /** Cleanup old resolved alerts. */
  cleanupOldAlerts(olderThanDays?: number): Promise<{ count: number }>;

  /** Count alerts by filters. */
  count(filters?: NetworkAlertFilters): Promise<number>;
}
