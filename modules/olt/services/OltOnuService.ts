import { OnuRepository } from "../repositories/OnuRepository";
import { PreRegistrationRepository } from "../repositories/PreRegistrationRepository";
import { OnuPowerHistoryRepository } from "../repositories/OnuPowerHistoryRepository";
import type { OnuDevice } from "../domain/entities/onu-device.entity";

interface OnuListFilters {
  tenantId: string;
  oltId?: string;
  slotFrame?: number;
  slot?: number;
  ponPort?: number;
  status?: string;
  search?: string;
  page: number;
  limit: number;
}

interface OnuListResult {
  data: OnuDevice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class OltOnuService {
  private onuRepo = new OnuRepository();
  private preRegRepo = new PreRegistrationRepository();
  private powerRepo = new OnuPowerHistoryRepository();

  async getOnuById(id: string, tenantId: string): Promise<OnuDevice | null> {
    return this.onuRepo.findById(id, tenantId);
  }

  async listOnus(filters: OnuListFilters): Promise<OnuListResult> {
    return this.onuRepo.findMany(filters);
  }

  async listUnregistered(
    tenantId: string,
    oltId?: string,
  ): Promise<OnuDevice[]> {
    return this.onuRepo.findUnregistered(tenantId, oltId);
  }

  async listPreRegistrations(tenantId: string, page: number, limit: number) {
    return this.preRegRepo.findAll(tenantId, page, limit);
  }

  async createPreRegistration(input: {
    tenantId: string;
    serialNumber: string;
    createdBy: string;
    oltId?: string;
    pelangganId?: string;
    bandwidthProfile?: string;
    vlanId?: number;
  }) {
    return this.preRegRepo.create(input);
  }

  async getPowerHistory(onuId: string, tenantId: string, hours: number = 24) {
    return this.powerRepo.getHistory(onuId, tenantId, hours);
  }

  async findPendingPreRegistration(tenantId: string, serialNumber: string) {
    return this.preRegRepo.findPendingBySerialNumber(tenantId, serialNumber);
  }
}
