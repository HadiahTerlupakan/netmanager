import type {
  OltDevice,
  OltDeviceCreateInput,
  OltDeviceListFilters,
  OltDeviceListResult,
  OltDeviceUpdateInput,
} from "../entities/olt-device.entity";

export interface IOltRepository {
  findById(id: string, tenantId: string): Promise<OltDevice | null>;
  findAllActive(tenantId: string): Promise<OltDevice[]>;
  findMany(filters: OltDeviceListFilters): Promise<OltDeviceListResult>;
  create(input: OltDeviceCreateInput): Promise<OltDevice>;
  update(
    id: string,
    tenantId: string,
    input: OltDeviceUpdateInput,
  ): Promise<OltDevice>;
  delete(id: string, tenantId: string): Promise<void>;
}
