import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import type { ServiceResult } from "../domain/ports/IOltAdapter";
import type {
  OnuDevice,
  RegisterOnuParams,
} from "../domain/entities/onu-device.entity";
import { OltRepository } from "../repositories/OltRepository";
import { OnuRepository } from "../repositories/OnuRepository";
import { PreRegistrationRepository } from "../repositories/PreRegistrationRepository";
import { OltAdapterFactory } from "../adapters/OltAdapterFactory";
import { OltConnectionManager } from "../adapters/OltConnectionManager";
import { OltCommandLogService } from "./OltCommandLogService";

const PRISMA_UNIQUE_VIOLATION = "P2002";

export class OltProvisioningService {
  private oltRepo = new OltRepository();
  private onuRepo = new OnuRepository();
  private preRegRepo = new PreRegistrationRepository();
  private adapterFactory = new OltAdapterFactory();
  private connectionManager = new OltConnectionManager();
  private commandLog = new OltCommandLogService();

  async registerOnu(
    oltId: string,
    tenantId: string,
    params: RegisterOnuParams,
    userId: string,
  ): Promise<ServiceResult<OnuDevice>> {
    const olt = await this.oltRepo.findById(oltId, tenantId);
    if (!olt) {
      return {
        success: false,
        error: "OLT tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    const existing = await this.onuRepo.findBySerialNumber(
      tenantId,
      params.serialNumber,
    );
    if (existing && existing.status !== "UNREGISTERED") {
      return {
        success: false,
        error: `ONU ${params.serialNumber} sudah terdaftar`,
        code: "ONU_ALREADY_REGISTERED",
      };
    }

    if (
      params.onuIndex !== undefined &&
      (await this.onuRepo.findRegisteredAtPosition(
        olt.id,
        params.ponPort,
        params.onuIndex,
      ))
    ) {
      return {
        success: false,
        error: `Posisi ${params.ponPort}:${params.onuIndex} sudah terpakai`,
        code: "POSITION_TAKEN",
      };
    }

    const adapter = this.adapterFactory.getAdapter(olt.vendor);

    const result = await this.connectionManager.withRetry(
      () => adapter.registerOnu(olt, params),
      `registerOnu ${params.serialNumber}`,
    );

    if (!result.success || !result.data) {
      await this.commandLog.log({
        tenantId: olt.tenantId,
        oltId: olt.id,
        command: "REGISTER_ONU",
        params: params as unknown as Prisma.InputJsonValue,
        result: "FAILED",
        errorMsg: result.error,
        executedBy: userId,
      });
      return { success: false, error: result.error, code: result.code };
    }

    let onu: OnuDevice;
    try {
      onu = existing
        ? await this.onuRepo.update(existing.id, tenantId, {
            ponPort: result.data.ponPort,
            onuIndex: result.data.onuIndex,
            status: "REGISTERED",
            registeredAt: new Date(),
            bandwidthProfile: params.bandwidthProfile ?? null,
            vlanId: params.vlanId ?? null,
          })
        : await this.onuRepo.create({
            tenantId: olt.tenantId,
            oltId: olt.id,
            serialNumber: params.serialNumber,
            ponPort: result.data.ponPort,
            onuIndex: result.data.onuIndex,
            status: "REGISTERED",
            registeredAt: new Date(),
            bandwidthProfile: params.bandwidthProfile,
            vlanId: params.vlanId,
          });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_VIOLATION
      ) {
        return {
          success: false,
          error: `ONU ${params.serialNumber} sudah terdaftar (race)`,
          code: "ONU_ALREADY_REGISTERED",
        };
      }
      throw error;
    }

    await this.commandLog.log({
      tenantId: olt.tenantId,
      oltId: olt.id,
      onuId: onu.id,
      command: "REGISTER_ONU",
      params: params as unknown as Prisma.InputJsonValue,
      result: "SUCCESS",
      executedBy: userId,
    });

    const preReg = await this.preRegRepo.findPendingBySerialNumber(
      tenantId,
      params.serialNumber,
    );
    if (preReg) {
      await this.preRegRepo.markCompleted(preReg.id, tenantId);
    }

    logger.info(
      `[Provisioning] ONU ${params.serialNumber} registered on ${olt.name}`,
    );
    return { success: true, data: onu };
  }

  async deregisterOnu(
    onuId: string,
    tenantId: string,
    userId: string,
  ): Promise<ServiceResult<void>> {
    const onu = await this.onuRepo.findById(onuId, tenantId);
    if (!onu) {
      return {
        success: false,
        error: "ONU tidak ditemukan",
        code: "NOT_FOUND",
      };
    }
    if (onu.onuIndex === null) {
      await this.onuRepo.delete(onuId, tenantId);
      return { success: true, data: undefined };
    }

    const olt = await this.oltRepo.findById(onu.oltId, tenantId);
    if (!olt) {
      return {
        success: false,
        error: "OLT tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    const adapter = this.adapterFactory.getAdapter(olt.vendor);
    const result = await adapter.deregisterOnu(olt, {
      ponPort: onu.ponPort,
      onuIndex: onu.onuIndex,
    });

    if (!result.success) {
      await this.commandLog.log({
        tenantId: olt.tenantId,
        oltId: olt.id,
        onuId: onu.id,
        command: "DEREGISTER_ONU",
        params: { ponPort: onu.ponPort, onuIndex: onu.onuIndex },
        result: "FAILED",
        errorMsg: result.error,
        executedBy: userId,
      });
      return result;
    }

    await this.onuRepo.delete(onuId, tenantId);

    await this.commandLog.log({
      tenantId: olt.tenantId,
      oltId: olt.id,
      command: "DEREGISTER_ONU",
      params: {
        serialNumber: onu.serialNumber,
        ponPort: onu.ponPort,
        onuIndex: onu.onuIndex,
      },
      result: "SUCCESS",
      executedBy: userId,
    });

    logger.info(
      `[Provisioning] ONU ${onu.serialNumber} deregistered from ${olt.name}`,
    );
    return { success: true, data: undefined };
  }

  async assignOnuToPelanggan(
    onuId: string,
    tenantId: string,
    pelangganId: string,
    userId: string,
  ): Promise<ServiceResult<OnuDevice>> {
    const onu = await this.onuRepo.findById(onuId, tenantId);
    if (!onu) {
      return {
        success: false,
        error: "ONU tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    const updated = await this.onuRepo.update(onuId, tenantId, {
      pelangganId,
      status: "ACTIVE",
    });

    await this.commandLog.log({
      tenantId: onu.tenantId,
      oltId: onu.oltId,
      onuId: onu.id,
      command: "ASSIGN_PELANGGAN",
      params: { pelangganId },
      result: "SUCCESS",
      executedBy: userId,
    });

    logger.info(
      `[Provisioning] ONU ${onu.serialNumber} assigned to pelanggan ${pelangganId}`,
    );
    return { success: true, data: updated };
  }
}
