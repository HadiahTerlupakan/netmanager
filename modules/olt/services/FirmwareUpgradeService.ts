import { logger } from "@/lib/logger";
import type { ServiceResult } from "../domain/ports/IOltAdapter";
import { OltRepository } from "../repositories/OltRepository";
import { OnuRepository } from "../repositories/OnuRepository";
import { OltCommandLogService } from "./OltCommandLogService";
import { ZteTelnetClient } from "../adapters/zte/ZteTelnetClient";
import { ZteOidRegistry } from "../config/oid-registry/zte.oid";

export class FirmwareUpgradeService {
  private oltRepo = new OltRepository();
  private onuRepo = new OnuRepository();
  private commandLog = new OltCommandLogService();

  async upgradeOnuFirmware(
    onuId: string,
    firmwareFile: string,
    userId: string,
  ): Promise<ServiceResult<void>> {
    const onu = await this.onuRepo.findById(onuId);
    if (!onu)
      return {
        success: false,
        error: "ONU tidak ditemukan",
        code: "NOT_FOUND",
      };

    const olt = await this.oltRepo.findById(onu.oltId);
    if (!olt)
      return {
        success: false,
        error: "OLT tidak ditemukan",
        code: "NOT_FOUND",
      };

    if (olt.vendor !== "ZTE") {
      return {
        success: false,
        error: "Firmware upgrade hanya tersedia untuk ZTE",
        code: "NOT_IMPLEMENTED",
      };
    }

    const telnet = new ZteTelnetClient();
    try {
      await telnet.connect(olt);
      await telnet.configMode();

      const onuInterface = ZteOidRegistry.formatOnuInterface(
        1,
        1,
        onu.ponPort,
        onu.onuIndex,
      );
      await telnet.execute(`pon-onu-mng ${onuInterface}`);
      await telnet.execute(`firmware upgrade ${firmwareFile}`);
      await telnet.execute("exit");

      await telnet.exitConfig();
      await telnet.disconnect();

      await this.commandLog.log({
        tenantId: olt.tenantId,
        oltId: olt.id,
        onuId: onu.id,
        command: "FIRMWARE_UPGRADE",
        params: { firmwareFile, serialNumber: onu.serialNumber },
        result: "SUCCESS",
        executedBy: userId,
      });

      logger.info(
        `[Firmware] Upgrade initiated for ONU ${onu.serialNumber}: ${firmwareFile}`,
      );
      return { success: true, data: undefined };
    } catch (error) {
      await telnet.disconnect();
      const msg =
        error instanceof Error ? error.message : "Firmware upgrade failed";

      await this.commandLog.log({
        tenantId: olt.tenantId,
        oltId: olt.id,
        onuId: onu.id,
        command: "FIRMWARE_UPGRADE",
        params: { firmwareFile, serialNumber: onu.serialNumber },
        result: "FAILED",
        errorMsg: msg,
        executedBy: userId,
      });

      return { success: false, error: msg, code: "TELNET_ERROR" };
    }
  }
}
