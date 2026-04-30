import type {
  NetworkAlertCreateData,
  NetworkAlertUpdateData,
} from "../domain/entities";
import type { INetworkAlertRepository } from "../domain/ports";
import type { NetworkAlertDTO } from "../dto/NetworkDTO";
import {
  toNetworkAlertDTO,
  toNetworkAlertDTOList,
} from "../mappers/NetworkMonitoringMapper";
import { NetworkAlertRepository } from "../repositories/NetworkAlertRepository";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MODEL_NOT_READY_CODE = "P2021";
const ALERT_MIGRATION_MESSAGE =
  "Network alerts will be available after database migration";

type AlertQueryInput = {
  deviceId?: string;
  deviceType?: "OLT" | "MIKROTIK" | "ONU";
  status?: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "SUPPRESSED";
  severity?: "CRITICAL" | "WARNING" | "INFO";
  alertType?: "CRITICAL" | "WARNING" | "INFO";
  acknowledged?: boolean;
  resolved?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

/** Kelola use case alert jaringan untuk API. */
export class NetworkAlertService {
  constructor(
    private readonly networkAlertRepository: INetworkAlertRepository = new NetworkAlertRepository(),
  ) {}

  /** Ambil daftar alert jaringan untuk response API. */
  async getAlertList(filters: AlertQueryInput) {
    try {
      const result = await this.networkAlertRepository.findMany(filters);
      return mapAlertListResult(result);
    } catch (error) {
      return this.handleListError(error, filters);
    }
  }

  /** Ambil satu alert jaringan untuk response API. */
  async getAlertById(id: string): Promise<NetworkAlertDTO | null> {
    const alert = await this.networkAlertRepository.findById(id);
    if (!alert) {
      return null;
    }

    return toNetworkAlertDTO(alert);
  }

  /** Buat alert jaringan baru. */
  async createAlert(data: NetworkAlertCreateData): Promise<{ id: string }> {
    const result = await this.networkAlertRepository.create(data);
    return { id: result.id };
  }

  /** Perbarui alert jaringan yang ada. */
  async updateAlert(params: {
    id: string;
    data: NetworkAlertUpdateData;
    userId: string;
  }): Promise<boolean> {
    const existingAlert = await this.networkAlertRepository.findById(params.id);
    if (!existingAlert) {
      return false;
    }

    await this.networkAlertRepository.update(
      params.id,
      buildAlertUpdateData(params.data, params.userId),
    );
    return true;
  }

  /** Hapus alert jaringan berdasarkan id. */
  async deleteAlert(id: string): Promise<NetworkAlertDTO | null> {
    const alert = await this.networkAlertRepository.findById(id);
    if (!alert) {
      return null;
    }

    await this.networkAlertRepository.delete(id);
    return toNetworkAlertDTO(alert);
  }

  /** Tangani fallback saat model database belum tersedia. */
  private handleListError(error: unknown, filters: AlertQueryInput) {
    if (!isModelNotReadyError(error)) {
      throw error;
    }

    return {
      data: [] as NetworkAlertDTO[],
      pagination: createEmptyPagination(filters),
      message: ALERT_MIGRATION_MESSAGE,
    };
  }
}

/** Bentuk data update alert berbasis user aksi. */
function buildAlertUpdateData(
  data: NetworkAlertUpdateData,
  userId: string,
): NetworkAlertUpdateData {
  const nextData = { ...data };

  if (data.acknowledged) {
    nextData.acknowledgedBy = userId;
  }

  if (data.resolved) {
    nextData.resolvedBy = userId;
  }

  return nextData;
}

/** Ubah hasil repository alert menjadi hasil API. */
function mapAlertListResult(result: {
  data: Awaited<ReturnType<INetworkAlertRepository["findMany"]>>["data"];
  pagination: Awaited<
    ReturnType<INetworkAlertRepository["findMany"]>
  >["pagination"];
}) {
  return {
    data: toNetworkAlertDTOList(result.data),
    pagination: result.pagination,
  };
}

/** Buat pagination fallback saat data alert belum tersedia. */
function createEmptyPagination(filters: AlertQueryInput) {
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
