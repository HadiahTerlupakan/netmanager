import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import { OltRepository } from "../repositories/OltRepository";
import { OnuRepository } from "../repositories/OnuRepository";
import { OnuPowerHistoryRepository } from "../repositories/OnuPowerHistoryRepository";
import { OltAlertService } from "./OltAlertService";
import { OltAdapterFactory } from "../adapters/OltAdapterFactory";

const RX_WARNING_THRESHOLD = -25;
const RX_CRITICAL_THRESHOLD = -28;

export class OnuMonitoringService {
  private oltRepo = new OltRepository();
  private onuRepo = new OnuRepository();
  private powerRepo = new OnuPowerHistoryRepository();
  private alertService = new OltAlertService();
  private adapterFactory = new OltAdapterFactory();

  async pollAllOlts(
    tenantId: string,
  ): Promise<{ polled: number; alerts: number }> {
    const olts = await this.oltRepo.findAllActive(tenantId);
    let totalPolled = 0;
    let totalAlerts = 0;

    for (const olt of olts) {
      try {
        const stats = await this.pollOlt(olt.id, olt.tenantId, olt.vendor);
        totalPolled += stats.polled;
        totalAlerts += stats.alerts;
      } catch (error) {
        logger.error(`[OnuMonitoring] Error polling ${olt.name}:`, error);
      }
    }

    logger.info(
      `[OnuMonitoring] Polled ${totalPolled} ONUs, ${totalAlerts} alerts created`,
    );
    return { polled: totalPolled, alerts: totalAlerts };
  }

  async pollSingleOlt(
    oltId: string,
    tenantId: string,
  ): Promise<{ polled: number; alerts: number }> {
    const olt = await this.oltRepo.findById(oltId, tenantId);
    if (!olt) return { polled: 0, alerts: 0 };
    return this.pollOlt(olt.id, olt.tenantId, olt.vendor);
  }

  async pollOnusByPon(
    oltId: string,
    tenantId: string,
    ponPort: number,
  ): Promise<{ polled: number; alerts: number }> {
    const olt = await this.oltRepo.findById(oltId, tenantId);
    if (!olt) return { polled: 0, alerts: 0 };

    const adapter = this.adapterFactory.getAdapter(olt.vendor);
    const statusResult = await adapter.getAllOnuStatuses(olt);
    if (!statusResult.success || !statusResult.data) {
      return { polled: 0, alerts: 0 };
    }

    const onuMap = await this.buildOnuMap(oltId, tenantId);

    let polled = 0;
    let alerts = 0;

    const filtered = statusResult.data.filter((s) => s.ponPort === ponPort);
    for (const status of filtered) {
      const key = `${status.ponPort}:${status.onuIndex}`;
      const onu = onuMap.get(key);
      if (!onu) continue;

      const newStatus = this.mapPhaseToOnuStatus(status.status);
      if (newStatus && newStatus !== onu.status) {
        await this.onuRepo.updateStatus(onu.id, tenantId, newStatus);
        if (newStatus === "LOS") {
          await this.alertService.createAlert({
            tenantId,
            oltId,
            onuId: onu.id,
            type: "LOS",
            message: `ONU ${onu.serialNumber} Loss of Signal pada port ${status.ponPort}:${status.onuIndex}`,
            severity: "CRITICAL",
          });
          alerts++;
        }
      }

      const powerResult = await adapter.getOnuOpticalPower(
        olt,
        status.ponPort,
        status.onuIndex,
      );
      if (powerResult.success && powerResult.data) {
        await this.powerRepo.record({
          tenantId,
          onuId: onu.id,
          rxPower: powerResult.data.rxPower,
          txPower: powerResult.data.txPower,
        });
        await this.onuRepo.update(onu.id, tenantId, {
          rxPower: powerResult.data.rxPower,
          txPower: powerResult.data.txPower,
          oltRxPower: powerResult.data.oltRxPower,
          lastSeen: new Date(),
        });
      }

      polled++;
    }

    logger.info(
      `[OnuMonitoring] Polled ${polled} ONUs on PON ${ponPort} of OLT ${olt.name}`,
    );
    return { polled, alerts };
  }

  private async pollOlt(
    oltId: string,
    tenantId: string,
    vendor: string,
  ): Promise<{ polled: number; alerts: number }> {
    const olt = await this.oltRepo.findById(oltId, tenantId);
    if (!olt) return { polled: 0, alerts: 0 };

    const adapter = this.adapterFactory.getAdapter(olt.vendor);
    const statusResult = await adapter.getAllOnuStatuses(olt);
    if (!statusResult.success || !statusResult.data) {
      return { polled: 0, alerts: 0 };
    }

    const onuMap = await this.buildOnuMap(oltId, tenantId);

    let polled = 0;
    let alerts = 0;

    for (const status of statusResult.data) {
      const key = `${status.ponPort}:${status.onuIndex}`;
      const onu = onuMap.get(key);
      if (!onu) continue;

      const newStatus = this.mapPhaseToOnuStatus(status.status);
      if (newStatus && newStatus !== onu.status) {
        await this.onuRepo.updateStatus(onu.id, tenantId, newStatus);
        if (newStatus === "LOS") {
          await this.alertService.createAlert({
            tenantId,
            oltId,
            onuId: onu.id,
            type: "LOS",
            message: `ONU ${onu.serialNumber} Loss of Signal pada port ${status.ponPort}:${status.onuIndex}`,
            severity: "CRITICAL",
          });
          alerts++;
        }
      }

      const powerResult = await adapter.getOnuOpticalPower(
        olt,
        status.ponPort,
        status.onuIndex,
      );
      if (!powerResult.success || !powerResult.data) continue;

      await this.powerRepo.record({
        tenantId,
        onuId: onu.id,
        rxPower: powerResult.data.rxPower,
        txPower: powerResult.data.txPower,
      });
      await this.onuRepo.update(onu.id, tenantId, {
        rxPower: powerResult.data.rxPower,
        txPower: powerResult.data.txPower,
        lastSeen: new Date(),
      });

      const rx = powerResult.data.rxPower;
      if (rx !== null) {
        if (rx < RX_CRITICAL_THRESHOLD) {
          await this.alertService.createAlert({
            tenantId,
            oltId,
            onuId: onu.id,
            type: "CRITICAL_POWER",
            message: `ONU ${onu.serialNumber} RX power critical: ${rx} dBm`,
            severity: "CRITICAL",
          });
          alerts++;
        } else if (rx < RX_WARNING_THRESHOLD) {
          await this.alertService.createAlert({
            tenantId,
            oltId,
            onuId: onu.id,
            type: "LOW_POWER",
            message: `ONU ${onu.serialNumber} RX power low: ${rx} dBm`,
            severity: "WARNING",
          });
          alerts++;
        }
      }

      polled++;
    }

    void vendor;
    return { polled, alerts };
  }

  private mapPhaseToOnuStatus(
    phase: "online" | "offline" | "los" | "dying_gasp" | "unknown",
  ): "ACTIVE" | "OFFLINE" | "LOS" | "DYING_GASP" | null {
    switch (phase) {
      case "online":
        return "ACTIVE";
      case "offline":
        return "OFFLINE";
      case "dying_gasp":
        return "DYING_GASP";
      case "los":
        return "LOS";
      case "unknown":
      default:
        return null;
    }
  }

  private async buildOnuMap(
    oltId: string,
    tenantId: string,
  ): Promise<
    Map<string, { id: string; serialNumber: string; status: string }>
  > {
    const onus = await prisma.onuDevice.findMany({
      where: { oltId, tenantId, status: { not: "UNREGISTERED" } },
      select: {
        id: true,
        ponPort: true,
        onuIndex: true,
        serialNumber: true,
        status: true,
      },
    });
    const map = new Map<
      string,
      { id: string; serialNumber: string; status: string }
    >();
    for (const onu of onus) {
      if (onu.onuIndex === null) continue;
      map.set(`${onu.ponPort}:${onu.onuIndex}`, {
        id: onu.id,
        serialNumber: onu.serialNumber,
        status: onu.status,
      });
    }
    return map;
  }
}
