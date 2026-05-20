import { logger } from "@/lib/logger";
import type { ServiceResult } from "../domain/ports/IOltAdapter";
import type { OpticalPower } from "../domain/entities/onu-device.entity";
import { OltRepository } from "../repositories/OltRepository";
import { OnuRepository } from "../repositories/OnuRepository";
import { OltAdapterFactory } from "../adapters/OltAdapterFactory";
import { OltConnectionManager } from "../adapters/OltConnectionManager";
import { OltCommandLogService } from "./OltCommandLogService";

export class OnuControlService {
  private oltRepo = new OltRepository();
  private onuRepo = new OnuRepository();
  private adapterFactory = new OltAdapterFactory();
  private connectionManager = new OltConnectionManager();
  private commandLog = new OltCommandLogService();

  async disableOnu(
    onuId: string,
    userId: string,
  ): Promise<ServiceResult<void>> {
    const ctx = await this.resolveContext(onuId);
    if (!ctx)
      return {
        success: false,
        error: "ONU atau OLT tidak ditemukan",
        code: "NOT_FOUND",
      };

    const { olt, onu, adapter } = ctx;
    const result = await this.connectionManager.withRetry(
      () => adapter.disableOnu(olt, onu.ponPort, onu.onuIndex),
      `disableOnu ${onu.serialNumber}`,
    );

    if (result.success) {
      await this.onuRepo.updateStatus(onuId, "DISABLED");
      logger.info(`[OnuControl] Disabled ONU ${onu.serialNumber}`);
    }

    await this.commandLog.log({
      tenantId: olt.tenantId,
      oltId: olt.id,
      onuId,
      command: "DISABLE_ONU",
      params: {
        serialNumber: onu.serialNumber,
        ponPort: onu.ponPort,
        onuIndex: onu.onuIndex,
      },
      result: result.success ? "SUCCESS" : "FAILED",
      errorMsg: result.error,
      executedBy: userId,
    });

    return result;
  }

  async enableOnu(onuId: string, userId: string): Promise<ServiceResult<void>> {
    const ctx = await this.resolveContext(onuId);
    if (!ctx)
      return {
        success: false,
        error: "ONU atau OLT tidak ditemukan",
        code: "NOT_FOUND",
      };

    const { olt, onu, adapter } = ctx;
    const result = await this.connectionManager.withRetry(
      () => adapter.enableOnu(olt, onu.ponPort, onu.onuIndex),
      `enableOnu ${onu.serialNumber}`,
    );

    if (result.success) {
      await this.onuRepo.updateStatus(onuId, "ACTIVE");
      logger.info(`[OnuControl] Enabled ONU ${onu.serialNumber}`);
    }

    await this.commandLog.log({
      tenantId: olt.tenantId,
      oltId: olt.id,
      onuId,
      command: "ENABLE_ONU",
      params: {
        serialNumber: onu.serialNumber,
        ponPort: onu.ponPort,
        onuIndex: onu.onuIndex,
      },
      result: result.success ? "SUCCESS" : "FAILED",
      errorMsg: result.error,
      executedBy: userId,
    });

    return result;
  }

  async resetOnu(onuId: string, userId: string): Promise<ServiceResult<void>> {
    const ctx = await this.resolveContext(onuId);
    if (!ctx)
      return {
        success: false,
        error: "ONU atau OLT tidak ditemukan",
        code: "NOT_FOUND",
      };

    const { olt, onu, adapter } = ctx;
    const result = await this.connectionManager.withRetry(
      () => adapter.resetOnu(olt, onu.ponPort, onu.onuIndex),
      `resetOnu ${onu.serialNumber}`,
    );

    await this.commandLog.log({
      tenantId: olt.tenantId,
      oltId: olt.id,
      onuId,
      command: "RESET_ONU",
      params: {
        serialNumber: onu.serialNumber,
        ponPort: onu.ponPort,
        onuIndex: onu.onuIndex,
      },
      result: result.success ? "SUCCESS" : "FAILED",
      errorMsg: result.error,
      executedBy: userId,
    });

    return result;
  }

  async rebootOnu(onuId: string, userId: string): Promise<ServiceResult<void>> {
    const ctx = await this.resolveContext(onuId);
    if (!ctx)
      return {
        success: false,
        error: "ONU atau OLT tidak ditemukan",
        code: "NOT_FOUND",
      };

    const { olt, onu, adapter } = ctx;
    const result = await this.connectionManager.withRetry(
      () => adapter.rebootOnu(olt, onu.ponPort, onu.onuIndex),
      `rebootOnu ${onu.serialNumber}`,
    );

    await this.commandLog.log({
      tenantId: olt.tenantId,
      oltId: olt.id,
      onuId,
      command: "REBOOT_ONU",
      params: {
        serialNumber: onu.serialNumber,
        ponPort: onu.ponPort,
        onuIndex: onu.onuIndex,
      },
      result: result.success ? "SUCCESS" : "FAILED",
      errorMsg: result.error,
      executedBy: userId,
    });

    return result;
  }

  async getOpticalPower(onuId: string): Promise<ServiceResult<OpticalPower>> {
    const ctx = await this.resolveContext(onuId);
    if (!ctx)
      return {
        success: false,
        error: "ONU atau OLT tidak ditemukan",
        code: "NOT_FOUND",
      };

    const { olt, onu, adapter } = ctx;
    return adapter.getOnuOpticalPower(olt, onu.ponPort, onu.onuIndex);
  }

  private async resolveContext(onuId: string) {
    const onu = await this.onuRepo.findById(onuId);
    if (!onu) return null;

    const olt = await this.oltRepo.findById(onu.oltId);
    if (!olt) return null;

    const adapter = this.adapterFactory.getAdapter(olt.vendor);
    return { olt, onu, adapter };
  }
}
