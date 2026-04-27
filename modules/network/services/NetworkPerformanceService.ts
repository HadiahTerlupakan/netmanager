import type { INetworkPerformanceRepository } from "../domain/ports/INetworkPerformanceRepository";
import type {
  NetworkPerformanceCreateData,
  NetworkPerformanceFilters,
} from "../domain/entities/NetworkPerformanceEntity";
import type { NetworkPerformanceDTO } from "../dto/NetworkDTO";
import {
  toNetworkPerformanceDTO,
  toNetworkPerformanceDTOList,
} from "../mappers/NetworkMonitoringMapper";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MODEL_NOT_READY_CODE = "P2021";
const PERFORMANCE_MIGRATION_MESSAGE =
  "Network performance monitoring will be available after database migration";

type PerformanceQueryInput = {
  deviceId?: string;
  deviceType?: "OLT" | "MIKROTIK" | "ONU";
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

/** Ubah filter query performa ke filter domain. */
function normalizeFilters(
  filters: PerformanceQueryInput,
): NetworkPerformanceFilters {
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
  constructor(
    private readonly networkPerformanceRepository: INetworkPerformanceRepository,
  ) {}

  /** Ambil daftar performa jaringan untuk response API. */
  async getPerformanceList(filters: PerformanceQueryInput) {
    try {
      const result = await this.networkPerformanceRepository.findMany(
        normalizeFilters(filters),
      );
      return mapPerformanceListResult(result);
    } catch (error) {
      return this.handleListError(error, filters);
    }
  }

  /** Ambil satu data performa jaringan untuk response API. */
  async getPerformanceById(id: string): Promise<NetworkPerformanceDTO | null> {
    try {
      const performance = await this.networkPerformanceRepository.findById(id);
      if (!performance) {
        return null;
      }

      return toNetworkPerformanceDTO(performance);
    } catch (error) {
      if (isModelNotReadyError(error)) {
        return null;
      }

      throw error;
    }
  }

  /** Ambil riwayat performa perangkat untuk response API. */
  async getPerformanceHistory(
    deviceId: string,
    filters: PerformanceQueryInput,
  ) {
    try {
      const result = await this.networkPerformanceRepository.findMany({
        ...normalizeFilters(filters),
        deviceId,
      });
      return mapPerformanceListResult(result);
    } catch (error) {
      return this.handleListError(error, filters);
    }
  }

  /** Buat satu record performa jaringan. */
  async createPerformance(
    data: NetworkPerformanceCreateData,
  ): Promise<{ id: string }> {
    const result = await this.networkPerformanceRepository.create(data);
    return { id: result.id };
  }

  /** Tangani fallback saat model database belum tersedia. */
  private handleListError(error: unknown, filters: PerformanceQueryInput) {
    if (!isModelNotReadyError(error)) {
      throw error;
    }

    return {
      data: [] as NetworkPerformanceDTO[],
      pagination: createEmptyPagination(filters),
      message: PERFORMANCE_MIGRATION_MESSAGE,
    };
  }
}

/** Ubah hasil repository performa menjadi hasil API. */
function mapPerformanceListResult(result: {
  data: Awaited<ReturnType<INetworkPerformanceRepository["findMany"]>>["data"];
  pagination: Awaited<
    ReturnType<INetworkPerformanceRepository["findMany"]>
  >["pagination"];
}) {
  return {
    data: toNetworkPerformanceDTOList(result.data),
    pagination: result.pagination,
  };
}

/** Buat pagination fallback saat data performa belum tersedia. */
function createEmptyPagination(filters: PerformanceQueryInput) {
  return {
    page: filters.page ?? DEFAULT_PAGE,
    limit: filters.limit ?? DEFAULT_LIMIT,
    total: 0,
    totalPages: 0,
  };
}

/** Periksa apakah error berasal dari model Prisma yang belum ada. */
function isModelNotReadyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as Error & { code?: string }).code === MODEL_NOT_READY_CODE
  );
}
