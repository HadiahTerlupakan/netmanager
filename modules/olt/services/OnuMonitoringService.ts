import { logger } from "@/lib/logger";
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
        const adapter = this.adapterFactory.getAdapter(olt.vendor);
        const statusResult = await adapter.getAllOnuStatuses(olt);

        if (!statusResult.success || !statusResult.data) continue;

        for (const onuStatus of statusResult.data) {
          const onu = await this.findOnuRecord(
            olt.id,
            onuStatus.ponPort,
            onuStatus.onuIndex,
          );
          if (!onu) continue;

          if (onuStatus.status === "los" && onu.status !== "LOS") {
            await this.onuRepo.updateStatus(onu.id, "LOS");
            await this.alertService.createAlert({
              tenantId: olt.tenantId,
              oltId: olt.id,
              onuId: onu.id,
              type: "LOS",
              message: `ONU ${onu.serialNumber} Loss of Signal pada port ${onuStatus.ponPort}:${onuStatus.onuIndex}`,
              severity: "CRITICAL",
            });
            totalAlerts++;
          }

          const powerResult = await adapter.getOnuOpticalPower(
            olt,
            onuStatus.ponPort,
            onuStatus.onuIndex,
          );
          if (powerResult.success && powerResult.data) {
            await this.powerRepo.record({
              tenantId: olt.tenantId,
              onuId: onu.id,
              rxPower: powerResult.data.rxPower,
              txPower: powerResult.data.txPower,
            });

            if (powerResult.data.rxPower !== null) {
              if (powerResult.data.rxPower < RX_CRITICAL_THRESHOLD) {
                await this.alertService.createAlert({
                  tenantId: olt.tenantId,
                  oltId: olt.id,
                  onuId: onu.id,
                  type: "CRITICAL_POWER",
                  message: `ONU ${onu.serialNumber} RX power critical: ${powerResult.data.rxPower} dBm`,
                  severity: "CRITICAL",
                });
                totalAlerts++;
              } else if (powerResult.data.rxPower < RX_WARNING_THRESHOLD) {
                await this.alertService.createAlert({
                  tenantId: olt.tenantId,
                  oltId: olt.id,
                  onuId: onu.id,
                  type: "LOW_POWER",
                  message: `ONU ${onu.serialNumber} RX power low: ${powerResult.data.rxPower} dBm`,
                  severity: "WARNING",
                });
                totalAlerts++;
              }
            }

            totalPolled++;
          }
        }
      } catch (error) {
        logger.error(`[OnuMonitoring] Error polling ${olt.name}:`, error);
      }
    }

    logger.info(
      `[OnuMonitoring] Polled ${totalPolled} ONUs, ${totalAlerts} alerts created`,
    );
    return { polled: totalPolled, alerts: totalAlerts };
  }

  private async findOnuRecord(
    oltId: string,
    ponPort: number,
    onuIndex: number,
  ) {
    const { prisma } = await import("@/modules/database");
    return prisma.onuDevice.findFirst({
      where: { oltId, ponPort, onuIndex, status: { not: "UNREGISTERED" } },
    });
  }
}
