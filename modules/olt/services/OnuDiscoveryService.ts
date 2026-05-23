import { logger } from "@/lib/logger";
import type { ServiceResult } from "../domain/ports/IOltAdapter";
import type {
  OnuStatus,
  UnregisteredOnu,
} from "../domain/entities/onu-device.entity";
import { OltRepository } from "../repositories/OltRepository";
import { OnuRepository } from "../repositories/OnuRepository";
import { PreRegistrationRepository } from "../repositories/PreRegistrationRepository";
import { OltAdapterFactory } from "../adapters/OltAdapterFactory";
import { OltConnectionManager } from "../adapters/OltConnectionManager";
import { OltProvisioningService } from "./OltProvisioningService";

const SYSTEM_USER_ID = "system";

/**
 * Map phase state ZTE (working/offline/los/dying_gasp) ke OnuStatus
 * domain enum (REGISTERED/ACTIVE/OFFLINE/LOS).
 *
 * "working" → ACTIVE (ONU online & lewat trafik)
 * "offline"/"dying_gasp" → OFFLINE (ONU teregistrasi tapi tidak terhubung)
 * "los" → LOS (loss of signal di kabel fiber)
 * undefined → REGISTERED (default — phase state tidak terbaca)
 */
function mapPhaseToOnuStatus(
  phase?: "online" | "offline" | "los" | "dying_gasp" | "unknown",
): OnuStatus {
  switch (phase) {
    case "online":
      return "ACTIVE";
    case "offline":
    case "dying_gasp":
      return "OFFLINE";
    case "los":
      return "LOS";
    default:
      return "REGISTERED";
  }
}

export class OnuDiscoveryService {
  private oltRepo = new OltRepository();
  private onuRepo = new OnuRepository();
  private preRegRepo = new PreRegistrationRepository();
  private adapterFactory = new OltAdapterFactory();
  private connectionManager = new OltConnectionManager();
  private provisioning = new OltProvisioningService();

  async discoverByOlt(
    oltId: string,
    tenantId: string,
  ): Promise<ServiceResult<number>> {
    const olt = await this.oltRepo.findById(oltId, tenantId);
    if (!olt) {
      return {
        success: false,
        error: "OLT tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    const adapter = this.adapterFactory.getAdapter(olt.vendor);
    const result = await this.connectionManager.withRetry(
      () => adapter.discoverUnregisteredOnus(olt),
      `discover ${olt.name}`,
    );

    if (!result.success || !result.data) {
      return { success: false, error: result.error, code: result.code };
    }

    let count = 0;
    for (const onu of result.data) {
      await this.onuRepo.upsertUnregistered({
        tenantId: olt.tenantId,
        oltId: olt.id,
        serialNumber: onu.serialNumber,
        ponPort: onu.ponPort,
        lastSeen: onu.lastSeen,
      });
      count++;

      await this.tryAutoRegisterFromPreReg(olt.id, olt.tenantId, onu);
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
      const result = await this.discoverByOlt(olt.id, tenantId);
      if (result.success && result.data) {
        perOlt[olt.name] = result.data;
        total += result.data;
      }
    }

    return { success: true, data: { total, perOlt } };
  }

  async searchBySerialNumber(
    oltId: string,
    tenantId: string,
    sn: string,
  ): Promise<ServiceResult<UnregisteredOnu | null>> {
    const olt = await this.oltRepo.findById(oltId, tenantId);
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

  /**
   * Import registered ONU dari OLT ke DB app. Berguna saat OLT pertama
   * kali ditambahkan dan sudah punya ratusan ONU teregistrasi yang
   * perlu dikenali oleh sistem agar bisa di-monitor / kontrol.
   */
  async syncRegisteredOnusFromOlt(
    oltId: string,
    tenantId: string,
  ): Promise<ServiceResult<{ imported: number; total: number }>> {
    const olt = await this.oltRepo.findById(oltId, tenantId);
    if (!olt) {
      return {
        success: false,
        error: "OLT tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    const adapter = this.adapterFactory.getAdapter(olt.vendor);
    const result = await this.connectionManager.withRetry(
      () => adapter.discoverRegisteredOnus(olt),
      `syncRegistered ${olt.name}`,
    );

    if (!result.success || !result.data) {
      return { success: false, error: result.error, code: result.code };
    }

    // VLAN sync — best-effort, kalau gagal tetap lanjut import tanpa VLAN
    const vlanResult = await adapter.discoverServicePortVlans(olt);
    const vlanMap =
      vlanResult.success && vlanResult.data
        ? vlanResult.data
        : new Map<string, { vlanId: number; serviceMode: number }>();
    if (!vlanResult.success) {
      logger.warn(
        `[OnuDiscovery] VLAN sync gagal untuk ${olt.name}: ${vlanResult.error}. Import lanjut tanpa data VLAN.`,
      );
    }

    // Phase state sync — best-effort
    const phaseResult = await adapter.discoverOnuPhaseStates(olt);
    const phaseMap =
      phaseResult.success && phaseResult.data
        ? phaseResult.data
        : new Map<
            string,
            "online" | "offline" | "los" | "dying_gasp" | "unknown"
          >();
    if (!phaseResult.success) {
      logger.warn(
        `[OnuDiscovery] Phase state sync gagal untuk ${olt.name}: ${phaseResult.error}. Status default REGISTERED.`,
      );
    }

    // RX+TX power sync — best-effort
    const rxResult = await adapter.discoverOnuRxPowers(olt);
    const rxMap =
      rxResult.success && rxResult.data
        ? rxResult.data
        : new Map<string, { rxPower: number | null; txPower: number | null }>();
    if (!rxResult.success) {
      logger.warn(
        `[OnuDiscovery] Optical power sync gagal untuk ${olt.name}: ${rxResult.error}.`,
      );
    }

    let imported = 0;
    for (const item of result.data) {
      try {
        const key = `${item.slotFrame}:${item.slot}:${item.ponPort}:${item.onuIndex}`;
        const vlanInfo = vlanMap.get(key);
        const phase = phaseMap.get(key);
        const optical = rxMap.get(key);
        await this.onuRepo.upsertRegistered({
          tenantId: olt.tenantId,
          oltId: olt.id,
          serialNumber: item.serialNumber,
          slotFrame: item.slotFrame,
          slot: item.slot,
          ponPort: item.ponPort,
          onuIndex: item.onuIndex,
          description: item.description,
          vendor: item.vendor,
          model: item.model,
          softwareVersion: item.softwareVersion,
          distance: item.distance,
          vlanId: vlanInfo?.vlanId ?? null,
          status: mapPhaseToOnuStatus(phase),
          rxPower: optical?.rxPower ?? null,
          txPower: optical?.txPower ?? null,
        });
        imported++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "unknown";
        logger.warn(`[OnuDiscovery] Gagal import ${item.serialNumber}: ${msg}`);
      }
    }

    logger.info(
      `[OnuDiscovery] Synced ${imported}/${result.data.length} registered ONUs from ${olt.name}`,
    );
    return {
      success: true,
      data: { imported, total: result.data.length },
    };
  }

  /**
   * Kalau SN ditemukan match dengan pre-registration PENDING, langsung
   * trigger registrasi penuh via OltProvisioningService. preReg.oltId
   * dipakai untuk memastikan auto-register hanya jalan di OLT yang
   * sesuai (atau wildcard kalau preReg tidak menentukan OLT).
   */
  private async tryAutoRegisterFromPreReg(
    oltId: string,
    tenantId: string,
    onu: UnregisteredOnu,
  ): Promise<void> {
    const preReg = await this.preRegRepo.findPendingBySerialNumber(
      tenantId,
      onu.serialNumber,
    );
    if (!preReg) return;
    if (preReg.oltId && preReg.oltId !== oltId) return;

    logger.info(
      `[OnuDiscovery] Pre-reg match → auto-registering ${onu.serialNumber}`,
    );

    const result = await this.provisioning.registerOnu(
      oltId,
      tenantId,
      {
        serialNumber: onu.serialNumber,
        ponPort: onu.ponPort,
        bandwidthProfile: preReg.bandwidthProfile ?? undefined,
        vlanId: preReg.vlanId ?? undefined,
      },
      SYSTEM_USER_ID,
    );

    if (!result.success) {
      logger.warn(
        `[OnuDiscovery] Auto-register ${onu.serialNumber} gagal: ${result.error}`,
      );
      return;
    }

    if (preReg.pelangganId && result.data) {
      await this.provisioning.assignOnuToPelanggan(
        result.data.id,
        tenantId,
        preReg.pelangganId,
        SYSTEM_USER_ID,
      );
    }
  }
}
