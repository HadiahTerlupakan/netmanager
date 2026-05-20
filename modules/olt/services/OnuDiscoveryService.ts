import { logger } from "@/lib/logger";
import type { ServiceResult } from "../domain/ports/IOltAdapter";
import type { UnregisteredOnu } from "../domain/entities/onu-device.entity";
import { OltRepository } from "../repositories/OltRepository";
import { OnuRepository } from "../repositories/OnuRepository";
import { PreRegistrationRepository } from "../repositories/PreRegistrationRepository";
import { OltAdapterFactory } from "../adapters/OltAdapterFactory";

export class OnuDiscoveryService {
  private oltRepo = new OltRepository();
  private onuRepo = new OnuRepository();
  private preRegRepo = new PreRegistrationRepository();
  private adapterFactory = new OltAdapterFactory();

  async discoverByOlt(oltId: string): Promise<ServiceResult<number>> {
    const olt = await this.oltRepo.findById(oltId);
    if (!olt) {
      return {
        success: false,
        error: "OLT tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    const adapter = this.adapterFactory.getAdapter(olt.vendor);
    const result = await adapter.discoverUnregisteredOnus(olt);

    if (!result.success || !result.data) {
      return { success: false, error: result.error, code: result.code };
    }

    let count = 0;
    for (const onu of result.data) {
      await this.onuRepo.upsertBySerialNumber({
        tenantId: olt.tenantId,
        oltId: olt.id,
        serialNumber: onu.serialNumber,
        ponPort: onu.ponPort,
        onuIndex: 0,
        status: "UNREGISTERED",
        lastSeen: onu.lastSeen,
      });
      count++;

      await this.checkPreRegistration(olt.id, olt.tenantId, onu);
    }

    logger.info(
      `[OnuDiscovery] Found ${count} unregistered ONUs on ${olt.name}`,
    );
    return { success: true, data: count };
  }

  async discoverAll(
    tenantId: string,
  ): Promise<ServiceResult<{ total: number; perOlt: Record<string, number> }>> {
    const olts = await this.oltRepo.findAllActive(tenantId);
    const perOlt: Record<string, number> = {};
    let total = 0;

    for (const olt of olts) {
      const result = await this.discoverByOlt(olt.id);
      if (result.success && result.data) {
        perOlt[olt.name] = result.data;
        total += result.data;
      }
    }

    return { success: true, data: { total, perOlt } };
  }

  async searchBySerialNumber(
    oltId: string,
    sn: string,
  ): Promise<ServiceResult<UnregisteredOnu | null>> {
    const olt = await this.oltRepo.findById(oltId);
    if (!olt) {
      return {
        success: false,
        error: "OLT tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    const adapter = this.adapterFactory.getAdapter(olt.vendor);
    return adapter.findOnuBySerialNumber(olt, sn);
  }

  private async checkPreRegistration(
    oltId: string,
    _tenantId: string,
    onu: UnregisteredOnu,
  ): Promise<void> {
    const preReg = await this.preRegRepo.findPendingBySerialNumber(
      onu.serialNumber,
    );
    if (!preReg) return;

    if (preReg.oltId && preReg.oltId !== oltId) return;

    logger.info(`[OnuDiscovery] Pre-registration match: ${onu.serialNumber}`);
    // Auto-registration akan di-handle oleh OltProvisioningService di flow terpisah
    // Di sini kita hanya log match — actual registration butuh lebih banyak context
  }
}
