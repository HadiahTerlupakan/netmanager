import { logger } from "@/lib/logger";
import type { OltDevice } from "../../domain/entities/olt-device.entity";
import type {
  IOltAdapter,
  ServiceResult,
} from "../../domain/ports/IOltAdapter";
import type {
  DeregisterOnuParams,
  OnuStatusInfo,
  OpticalPower,
  RegisteredOnu,
  RegisterOnuParams,
  RemoveVlanParams,
  SetVlanParams,
  UnregisteredOnu,
} from "../../domain/entities/onu-device.entity";
import { ZteTelnetClient } from "./ZteTelnetClient";
import { ZteSnmpClient } from "./ZteSnmpClient";
import { ZteOidRegistry } from "../../config/oid-registry/zte.oid";

export class ZteAdapter implements IOltAdapter {
  private snmp = new ZteSnmpClient();

  async testConnection(device: OltDevice): Promise<ServiceResult<boolean>> {
    try {
      const sysDescr = await this.snmp.testConnection(device);
      logger.info(`[ZteAdapter] SNMP OK: ${sysDescr}`);

      if (device.telnetUser && device.telnetPass) {
        const telnet = new ZteTelnetClient();
        const telnetOk = await telnet.testLogin(device);
        if (!telnetOk) {
          return {
            success: false,
            error: "Telnet login gagal",
            code: "AUTH_FAILED",
          };
        }
        logger.info(`[ZteAdapter] Telnet OK for ${device.name}`);
      }

      return { success: true, data: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Koneksi gagal: ${msg}`,
        code: "CONNECTION_FAILED",
      };
    }
  }

  async discoverUnregisteredOnus(
    device: OltDevice,
  ): Promise<ServiceResult<UnregisteredOnu[]>> {
    try {
      const baseOid = ZteOidRegistry.gpon.unregisteredOnuTable;
      const varbinds = await this.snmp.walk(device, baseOid);

      const onus: UnregisteredOnu[] = [];
      for (const vb of varbinds) {
        const parsed = ZteOidRegistry.parseOnuIndex(vb.oid, baseOid);
        if (!parsed) continue;

        const sn = this.extractSerialNumber(vb.value);
        if (!sn) continue;

        onus.push({
          serialNumber: sn,
          ponPort: parsed.port,
          vendor: undefined,
          model: undefined,
          lastSeen: new Date(),
        });
      }

      logger.info(
        `[ZteAdapter] Discovered ${onus.length} unregistered ONUs on ${device.name}`,
      );
      return { success: true, data: onus };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "SNMP walk failed";
      logger.error(`[ZteAdapter] Discovery failed on ${device.name}: ${msg}`);
      return { success: false, error: msg, code: "SNMP_ERROR" };
    }
  }

  async findOnuBySerialNumber(
    device: OltDevice,
    sn: string,
  ): Promise<ServiceResult<UnregisteredOnu | null>> {
    try {
      const result = await this.discoverUnregisteredOnus(device);
      if (!result.success || !result.data) {
        return { success: false, error: result.error, code: result.code };
      }

      const found = result.data.find(
        (onu) => onu.serialNumber.toUpperCase() === sn.toUpperCase(),
      );
      return { success: true, data: found ?? null };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Search failed";
      return { success: false, error: msg, code: "SNMP_ERROR" };
    }
  }

  async registerOnu(
    device: OltDevice,
    params: RegisterOnuParams,
  ): Promise<ServiceResult<RegisteredOnu>> {
    const telnet = new ZteTelnetClient();
    try {
      await telnet.connect(device);
      await telnet.configMode();

      const slot = 1;
      const ponInterface = ZteOidRegistry.formatPonInterface(
        1,
        slot,
        params.ponPort,
      );
      const onuIndex = params.onuIndex ?? 1;

      const commands = [
        `interface ${ponInterface}`,
        `onu ${onuIndex} type default sn ${params.serialNumber}`,
        `exit`,
      ];

      for (const cmd of commands) {
        const output = await telnet.execute(cmd);
        if (
          output.toLowerCase().includes("error") ||
          output.toLowerCase().includes("failed")
        ) {
          return {
            success: false,
            error: `Command rejected: ${output.trim()}`,
            code: "COMMAND_REJECTED",
          };
        }
      }

      await telnet.exitConfig();
      await telnet.disconnect();

      logger.info(
        `[ZteAdapter] Registered ONU ${params.serialNumber} on port ${params.ponPort}:${onuIndex}`,
      );
      return {
        success: true,
        data: {
          ponPort: params.ponPort,
          onuIndex,
          serialNumber: params.serialNumber,
        },
      };
    } catch (error) {
      await telnet.disconnect();
      const msg =
        error instanceof Error ? error.message : "Registration failed";
      logger.error(`[ZteAdapter] Register ONU failed: ${msg}`);
      return { success: false, error: msg, code: "TELNET_ERROR" };
    }
  }

  async deregisterOnu(
    device: OltDevice,
    params: DeregisterOnuParams,
  ): Promise<ServiceResult<void>> {
    const telnet = new ZteTelnetClient();
    try {
      await telnet.connect(device);
      await telnet.configMode();

      const slot = 1;
      const ponInterface = ZteOidRegistry.formatPonInterface(
        1,
        slot,
        params.ponPort,
      );

      const commands = [
        `interface ${ponInterface}`,
        `no onu ${params.onuIndex}`,
        `exit`,
      ];

      for (const cmd of commands) {
        await telnet.execute(cmd);
      }

      await telnet.exitConfig();
      await telnet.disconnect();

      logger.info(
        `[ZteAdapter] Deregistered ONU at port ${params.ponPort}:${params.onuIndex}`,
      );
      return { success: true, data: undefined };
    } catch (error) {
      await telnet.disconnect();
      const msg =
        error instanceof Error ? error.message : "Deregistration failed";
      return { success: false, error: msg, code: "TELNET_ERROR" };
    }
  }

  async disableOnu(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<void>> {
    const telnet = new ZteTelnetClient();
    try {
      await telnet.connect(device);
      await telnet.configMode();

      const onuInterface = ZteOidRegistry.formatOnuInterface(
        1,
        1,
        ponPort,
        onuIndex,
      );
      await telnet.execute(`interface ${onuInterface}`);
      await telnet.execute("shutdown");
      await telnet.execute("exit");

      await telnet.exitConfig();
      await telnet.disconnect();

      logger.info(`[ZteAdapter] Disabled ONU at port ${ponPort}:${onuIndex}`);
      return { success: true, data: undefined };
    } catch (error) {
      await telnet.disconnect();
      const msg = error instanceof Error ? error.message : "Disable failed";
      return { success: false, error: msg, code: "TELNET_ERROR" };
    }
  }

  async enableOnu(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<void>> {
    const telnet = new ZteTelnetClient();
    try {
      await telnet.connect(device);
      await telnet.configMode();

      const onuInterface = ZteOidRegistry.formatOnuInterface(
        1,
        1,
        ponPort,
        onuIndex,
      );
      await telnet.execute(`interface ${onuInterface}`);
      await telnet.execute("no shutdown");
      await telnet.execute("exit");

      await telnet.exitConfig();
      await telnet.disconnect();

      logger.info(`[ZteAdapter] Enabled ONU at port ${ponPort}:${onuIndex}`);
      return { success: true, data: undefined };
    } catch (error) {
      await telnet.disconnect();
      const msg = error instanceof Error ? error.message : "Enable failed";
      return { success: false, error: msg, code: "TELNET_ERROR" };
    }
  }

  async resetOnu(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<void>> {
    const telnet = new ZteTelnetClient();
    try {
      await telnet.connect(device);
      await telnet.configMode();

      const onuInterface = ZteOidRegistry.formatOnuInterface(
        1,
        1,
        ponPort,
        onuIndex,
      );
      await telnet.execute(`pon-onu-mng ${onuInterface}`);
      await telnet.execute("reboot");
      await telnet.execute("exit");

      await telnet.exitConfig();
      await telnet.disconnect();

      logger.info(`[ZteAdapter] Reset ONU at port ${ponPort}:${onuIndex}`);
      return { success: true, data: undefined };
    } catch (error) {
      await telnet.disconnect();
      const msg = error instanceof Error ? error.message : "Reset failed";
      return { success: false, error: msg, code: "TELNET_ERROR" };
    }
  }

  async rebootOnu(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<void>> {
    return this.resetOnu(device, ponPort, onuIndex);
  }

  async setOnuVlan(
    device: OltDevice,
    params: SetVlanParams,
  ): Promise<ServiceResult<void>> {
    const telnet = new ZteTelnetClient();
    try {
      await telnet.connect(device);
      await telnet.configMode();

      const onuInterface = ZteOidRegistry.formatOnuInterface(
        1,
        1,
        params.ponPort,
        params.onuIndex,
      );
      await telnet.execute(`interface ${onuInterface}`);

      const vlanCmd =
        params.vlanMode === "transparent"
          ? `service-port 1 vlan ${params.vlanId} user-vlan untagged`
          : `service-port 1 vlan ${params.vlanId} user-vlan ${params.vlanId}`;
      await telnet.execute(vlanCmd);
      await telnet.execute("exit");

      await telnet.exitConfig();
      await telnet.disconnect();

      logger.info(
        `[ZteAdapter] Set VLAN ${params.vlanId} on port ${params.ponPort}:${params.onuIndex}`,
      );
      return { success: true, data: undefined };
    } catch (error) {
      await telnet.disconnect();
      const msg = error instanceof Error ? error.message : "Set VLAN failed";
      return { success: false, error: msg, code: "TELNET_ERROR" };
    }
  }

  async removeOnuVlan(
    device: OltDevice,
    params: RemoveVlanParams,
  ): Promise<ServiceResult<void>> {
    const telnet = new ZteTelnetClient();
    try {
      await telnet.connect(device);
      await telnet.configMode();

      const onuInterface = ZteOidRegistry.formatOnuInterface(
        1,
        1,
        params.ponPort,
        params.onuIndex,
      );
      await telnet.execute(`interface ${onuInterface}`);
      await telnet.execute("no service-port 1");
      await telnet.execute("exit");

      await telnet.exitConfig();
      await telnet.disconnect();

      logger.info(
        `[ZteAdapter] Removed VLAN on port ${params.ponPort}:${params.onuIndex}`,
      );
      return { success: true, data: undefined };
    } catch (error) {
      await telnet.disconnect();
      const msg = error instanceof Error ? error.message : "Remove VLAN failed";
      return { success: false, error: msg, code: "TELNET_ERROR" };
    }
  }

  async getOnuStatus(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<OnuStatusInfo>> {
    try {
      const slotFrame = 1;
      const slot = 1;
      const statusOid = ZteOidRegistry.gpon.onuStatus(
        slotFrame,
        slot,
        ponPort,
        onuIndex,
      );
      const snOid = ZteOidRegistry.gpon.onuSerialNumber(
        slotFrame,
        slot,
        ponPort,
        onuIndex,
      );

      const results = await this.snmp.get(device, [statusOid, snOid]);

      const statusValue = Number(results[0]?.value ?? 5);
      const serialNumber =
        this.extractSerialNumber(results[1]?.value) ?? "UNKNOWN";
      const status = (ZteOidRegistry.statusMap[statusValue] ??
        "unknown") as OnuStatusInfo["status"];

      return {
        success: true,
        data: { ponPort, onuIndex, serialNumber, status },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "SNMP get failed";
      return { success: false, error: msg, code: "SNMP_ERROR" };
    }
  }

  async getOnuOpticalPower(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<OpticalPower>> {
    try {
      const slotFrame = 1;
      const slot = 1;
      const rxOid = ZteOidRegistry.gpon.onuRxPower(
        slotFrame,
        slot,
        ponPort,
        onuIndex,
      );
      const txOid = ZteOidRegistry.gpon.onuTxPower(
        slotFrame,
        slot,
        ponPort,
        onuIndex,
      );

      const results = await this.snmp.get(device, [rxOid, txOid]);

      const rxRaw = Number(results[0]?.value);
      const txRaw = Number(results[1]?.value);

      return {
        success: true,
        data: {
          rxPower: isNaN(rxRaw) ? null : rxRaw / 100,
          txPower: isNaN(txRaw) ? null : txRaw / 100,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "SNMP get failed";
      return { success: false, error: msg, code: "SNMP_ERROR" };
    }
  }

  async getAllOnuStatuses(
    device: OltDevice,
  ): Promise<ServiceResult<OnuStatusInfo[]>> {
    try {
      const baseOid = ZteOidRegistry.gpon.onuStatusTable;
      const varbinds = await this.snmp.walk(device, baseOid);

      const statuses: OnuStatusInfo[] = [];
      for (const vb of varbinds) {
        const parsed = ZteOidRegistry.parseOnuIndex(vb.oid, baseOid);
        if (!parsed) continue;

        const statusValue = Number(vb.value);
        const status = (ZteOidRegistry.statusMap[statusValue] ??
          "unknown") as OnuStatusInfo["status"];

        statuses.push({
          ponPort: parsed.port,
          onuIndex: parsed.onuIndex,
          serialNumber: "",
          status,
        });
      }

      return { success: true, data: statuses };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "SNMP walk failed";
      return { success: false, error: msg, code: "SNMP_ERROR" };
    }
  }

  private extractSerialNumber(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === "string") return value.trim();
    if (Buffer.isBuffer(value)) return value.toString("hex").toUpperCase();
    return String(value).trim() || null;
  }
}
