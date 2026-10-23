import type {
  NetworkPerformanceCreateData,
  NetworkPerformanceEntity,
  NetworkPerformanceFilters,
  NetworkPerformanceUpdateData,
} from "../entities/NetworkPerformanceEntity";

export interface INetworkPerformanceRepository {
  /** Create one network performance record. */
  create(data: NetworkPerformanceCreateData): Promise<NetworkPerformanceEntity>;

  /** Get one network performance record by id. */
  findById(id: string): Promise<NetworkPerformanceEntity | null>;

  /** Get records by device id and type. */
  findByDeviceId(
    deviceId: string,
    deviceType: string,
    filters?: NetworkPerformanceFilters,
  ): Promise<{
    data: NetworkPerformanceEntity[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>;

  /** Get records by filters. */
  findMany(
    filters?: NetworkPerformanceFilters,
  ): Promise<{
    data: NetworkPerformanceEntity[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>;

  /** Update one network performance record. */
  update(id: string, data: NetworkPerformanceUpdateData): Promise<void>;

  /** Delete one network performance record. */
  delete(id: string): Promise<void>;

  /** Delete records by device scope. */
  deleteByDeviceId(
    deviceId: string,
    deviceType: string,
    olderThanDays?: number,
  ): Promise<{ count: number }>;

  /** Count records by filters. */
  count(filters?: NetworkPerformanceFilters): Promise<number>;
}
