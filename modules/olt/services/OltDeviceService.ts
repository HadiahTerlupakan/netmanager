import { logger } from "@/lib/logger";
import type {
  OltDevice,
  OltDeviceCreateInput,
  OltDeviceListFilters,
  OltDeviceListResult,
  OltDeviceUpdateInput,
} from "../domain/entities/olt-device.entity";
import type { ServiceResult } from "../domain/ports/IOltAdapter";
import { OltRepository } from "../repositories/OltRepository";
import { OltAdapterFactory } from "../adapters/OltAdapterFactory";
import { OltConnectionManager } from "../adapters/OltConnectionManager";
import { OltCommandLogService } from "./OltCommandLogService";

export class OltDeviceService {
  private repository = new OltRepository();
  private adapterFactory = new OltAdapterFactory();
  private connectionManager = new OltConnectionManager();
  private commandLog = new OltCommandLogService();

  async list(filters: OltDeviceListFilters): Promise<OltDeviceListResult> {
    return this.repository.findMany(filters);
  }

  async getById(id: string, tenantId: string): Promise<OltDevice | null> {
    return this.repository.findById(id, tenantId);
  }

  async create(input: OltDeviceCreateInput): Promise<OltDevice> {
    const device = await this.repository.create(input);
    logger.info(
      `[OltDeviceService] OLT created: ${device.name} (${device.vendor})`,
    );
    return device;
  }

  async update(
    id: string,
    tenantId: string,
    input: OltDeviceUpdateInput,
  ): Promise<OltDevice> {
    const device = await this.repository.update(id, tenantId, input);
    logger.info(`[OltDeviceService] OLT updated: ${device.name}`);
    return device;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const device = await this.repository.findById(id, tenantId);
    if (!device) return;
    await this.repository.delete(id, tenantId);
    logger.info(`[OltDeviceService] OLT deleted: ${device.name}`);
  }

  async testConnection(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<ServiceResult<boolean>> {
    const device = await this.repository.findById(id, tenantId);
    if (!device) {
      return {
        success: false,
        error: "OLT tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    const adapter = this.adapterFactory.getAdapter(device.vendor);

    const result = await this.connectionManager.withRetry(
      () => adapter.testConnection(device),
      `testConnection ${device.name}`,
    );

    await this.commandLog.log({
      tenantId: device.tenantId,
      oltId: device.id,
      command: "TEST_CONNECTION",
      params: { ip: device.ipAddress, vendor: device.vendor },
      result: result.success ? "SUCCESS" : "FAILED",
      errorMsg: result.error,
      executedBy: userId,
    });

    return result;
  }
}
