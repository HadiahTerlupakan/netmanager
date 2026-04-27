import {
  NetworkPerformanceRepository,
  type NetworkPerformanceCreateData,
  type NetworkPerformanceFilters,
} from "../repositories";

function normalizeFilters(filters: {
  deviceId?: string;
  deviceType?: "OLT" | "MIKROTIK" | "ONU";
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): NetworkPerformanceFilters {
  return {
    deviceId: filters.deviceId,
    deviceType: filters.deviceType,
    startDate: filters.startDate ? new Date(filters.startDate) : undefined,
    endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  };
}

export class NetworkPerformanceService {
  private networkPerformanceRepository = new NetworkPerformanceRepository();

  /**
   * Get network performance data with filtering and pagination.
   */
  async getPerformanceList(filters: {
    deviceId?: string;
    deviceType?: "OLT" | "MIKROTIK" | "ONU";
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    try {
      return await this.networkPerformanceRepository.findMany(
        normalizeFilters(filters),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        (error as unknown as { code?: string }).code === "P2021"
      ) {
        return {
          data: [] as Awaited<
            ReturnType<NetworkPerformanceRepository["findMany"]>
          >["data"],
          pagination: {
            page: filters.page || 1,
            limit: filters.limit || 20,
            total: 0,
            totalPages: 0,
          },
          message:
            "Network performance monitoring will be available after database migration",
        };
      }

      throw error;
    }
  }

  /**
   * Create a network performance record.
   */
  async createPerformance(
    data: NetworkPerformanceCreateData,
  ): Promise<{ id: string }> {
    const result = await this.networkPerformanceRepository.create(data);
    return { id: result.id };
  }
}

let networkPerformanceServiceInstance: NetworkPerformanceService | null = null;

/**
 * Get singleton network performance service instance.
 */
export function getNetworkPerformanceService(): NetworkPerformanceService {
  if (!networkPerformanceServiceInstance) {
    networkPerformanceServiceInstance = new NetworkPerformanceService();
  }

  return networkPerformanceServiceInstance;
}
