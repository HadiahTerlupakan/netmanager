import { logger } from "@/lib/logger";
import type { ServiceResult } from "../domain/ports/IOltAdapter";
import { OnuControlService } from "./OnuControlService";
import { OltProvisioningService } from "./OltProvisioningService";
import type { RegisterOnuParams } from "../domain/entities/onu-device.entity";

interface BulkResult {
  total: number;
  success: number;
  failed: number;
  results: Array<{ id: string; success: boolean; error?: string }>;
}

export class BulkOperationService {
  private onuControl = new OnuControlService();
  private provisioning = new OltProvisioningService();

  async bulkDisable(
    onuIds: string[],
    tenantId: string,
    userId: string,
  ): Promise<ServiceResult<BulkResult>> {
    return this.executeBulk(onuIds, (id) =>
      this.onuControl.disableOnu(id, tenantId, userId),
    );
  }

  async bulkEnable(
    onuIds: string[],
    tenantId: string,
    userId: string,
  ): Promise<ServiceResult<BulkResult>> {
    return this.executeBulk(onuIds, (id) =>
      this.onuControl.enableOnu(id, tenantId, userId),
    );
  }

  async bulkRegister(
    items: Array<{ oltId: string; params: RegisterOnuParams }>,
    tenantId: string,
    userId: string,
  ): Promise<ServiceResult<BulkResult>> {
    const results: BulkResult = {
      total: items.length,
      success: 0,
      failed: 0,
      results: [],
    };

    for (const item of items) {
      const result = await this.provisioning.registerOnu(
        item.oltId,
        tenantId,
        item.params,
        userId,
      );
      if (result.success) {
        results.success++;
        results.results.push({ id: item.params.serialNumber, success: true });
      } else {
        results.failed++;
        results.results.push({
          id: item.params.serialNumber,
          success: false,
          error: result.error,
        });
      }
    }

    logger.info(
      `[BulkOps] Register: ${results.success}/${results.total} success`,
    );
    return { success: true, data: results };
  }

  private async executeBulk(
    ids: string[],
    operation: (id: string) => Promise<ServiceResult<void>>,
  ): Promise<ServiceResult<BulkResult>> {
    const results: BulkResult = {
      total: ids.length,
      success: 0,
      failed: 0,
      results: [],
    };

    for (const id of ids) {
      const result = await operation(id);
      if (result.success) {
        results.success++;
        results.results.push({ id, success: true });
      } else {
        results.failed++;
        results.results.push({ id, success: false, error: result.error });
      }
    }

    return { success: true, data: results };
  }
}
