import { logger } from "@/lib/logger";
import type { OltDevice } from "../../domain/entities/olt-device.entity";
import type { DiscoveredCard } from "../../domain/entities/olt-card.entity";
import type {
  IOltAdapter,
  ServiceResult,
} from "../../domain/ports/IOltAdapter";
import type {
  DeregisterOnuParams,
  DiscoveredRegisteredOnu,
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

const DEFAULT_SERVICE_PORT_INDEX = 1;
const DEFAULT_TCONT_INDEX = 1;
const DEFAULT_GEMPORT_INDEX = 1;

/**
 * ZTE OLT adapter — verified against C300 production firmware (~V2.x)
 * Mei 2026.
 *
 * KEY CONVENTIONS (lapangan C300):
 *
 * 1. Register ONU: `onu N type ALL sn X` (BUKAN `type default`)
 *    type ALL = profile generic accept all ONU vendor.
 *
 * 2. Provisioning ONU (T-CONT, GEM, service-port): masuk
 *    `interface gpon-onu_F/S/P:N` mode, BUKAN `pon-onu-mng` mode.
 *    `pon-onu-mng` di firmware ini dipakai untuk profile-level config.
 *
 * 3. Disable/enable ONU: `shutdown` / `no shutdown` di interface mode.
 *
 * 4. ifIndex SNMP: 32-bit encoded `(frame<<28)|(0xFF<<16)|(slot<<8)|port`,
 *    BUKAN 4-tuple `frame.slot.port.onuIndex`. Lihat
 *    `config/oid-registry/zte.oid.ts`.
 */
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
        code: this.classifyConnectionError(error),
      };
    }
  }

  async discoverUnregisteredOnus(
    device: OltDevice,
  ): Promise<ServiceResult<UnregisteredOnu[]>> {
    // SNMP-based discovery: branch unregistered ONU table belum tentu
    // tersedia di semua firmware. Verified di C300 V2.x lapangan
    // (BRAS-CARIU-BGR): branch return "No Such Object".
    // Untuk firmware itu, fallback ke CLI `show gpon onu uncfg`.
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

      if (onus.length > 0) {
        logger.info(
          `[ZteAdapter] Discovered ${onus.length} unregistered ONUs on ${device.name} (via SNMP)`,
        );
        return { success: true, data: onus };
      }

      logger.debug(
        `[ZteAdapter] SNMP discovery 0 result, fallback to CLI for ${device.name}`,
      );
      return this.discoverUnregisteredOnusViaCli(device);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "SNMP walk failed";
      if (/no such object/i.test(msg)) {
        logger.info(
          `[ZteAdapter] SNMP unregistered branch unavailable on ${device.name}, using CLI fallback`,
        );
        return this.discoverUnregisteredOnusViaCli(device);
      }
      return this.snmpFailure(error, "SNMP walk failed");
    }
  }

  /**
   * CLI-based discovery via `show gpon onu uncfg`. Format C300:
   *
   *   gpon-olt_1/7/8  ZTEGCAFFFC3F  unauth
   *
   * Regex defensif agar match meski format kolom bervariasi antar firmware.
   */
  private async discoverUnregisteredOnusViaCli(
    device: OltDevice,
  ): Promise<ServiceResult<UnregisteredOnu[]>> {
    return this.runTelnet(device, async (telnet) => {
      await telnet.exitConfig();
      const output = await telnet.execute("show gpon onu uncfg");

      const onus: UnregisteredOnu[] = [];
      const lines = output.split(/\r?\n/);
      const ponInterfaceRegex = /gpon-olt_\d+\/\d+\/(\d+)\s+([A-Z0-9]{8,32})/i;

      for (const line of lines) {
        const m = ponInterfaceRegex.exec(line);
        if (!m) continue;
        const [, portStr, sn] = m;
        onus.push({
          serialNumber: sn.toUpperCase(),
          ponPort: Number(portStr),
          vendor: undefined,
          model: undefined,
          lastSeen: new Date(),
        });
      }

      logger.info(
        `[ZteAdapter] Discovered ${onus.length} unregistered ONUs on ${device.name} (via CLI)`,
      );
      return onus;
    });
  }

  /**
   * Walk SNMP service-port table untuk pull VLAN per ONU.
   *
   * Strategy:
   *   1. Walk CVid table (.18, network-side CVLAN setelah translation)
   *   2. Walk UserVid table (.8, user-side VLAN dari sisi ONU)
   *   3. Per ONU: pakai CVid kalau ada (>0), fallback ke UserVid
   *
   * Verified C300 V2.1.0 lapangan:
   *   Slot 8: CVid=UserVid (213/214) — 1-to-1 mapping
   *   Slot 9: CVid=0, UserVid=212-216 — pakai UserVid (no translation)
   *
   * Kalau 1 ONU punya banyak service-port, ambil yang pertama dengan
   * VLAN valid (1-4094). Untuk monitoring purposes, satu VLAN per ONU
   * sudah cukup representatif.
   */
  async discoverServicePortVlans(
    device: OltDevice,
  ): Promise<
    ServiceResult<Map<string, { vlanId: number; serviceMode: number }>>
  > {
    try {
      const cVidTable = ZteOidRegistry.servicePort.cVidTable;
      const userVidTable = ZteOidRegistry.servicePort.userVidTable;
      const modeTable = ZteOidRegistry.servicePort.serviceModeTable;

      const [cvidVarbinds, userVidVarbinds, modeVarbinds] = await Promise.all([
        this.snmp.walk(device, cVidTable),
        this.snmp.walk(device, userVidTable),
        this.snmp.walk(device, modeTable),
      ]);

      const modeBySuffix = new Map<string, number>();
      for (const vb of modeVarbinds) {
        const suffix = vb.oid.slice(modeTable.length + 1);
        const mode = Number(vb.value);
        if (!isNaN(mode)) modeBySuffix.set(suffix, mode);
      }

      const userVidBySuffix = new Map<string, number>();
      for (const vb of userVidVarbinds) {
        const suffix = vb.oid.slice(userVidTable.length + 1);
        const vid = Number(vb.value);
        if (!isNaN(vid) && vid > 0 && vid <= 4094) {
          userVidBySuffix.set(suffix, vid);
        }
      }

      const result = new Map<string, { vlanId: number; serviceMode: number }>();

      // Pass 1: CVid table — pakai kalau >0
      for (const vb of cvidVarbinds) {
        const parsed = ZteOidRegistry.parseServicePortIndex(vb.oid, cVidTable);
        if (!parsed) continue;

        const vlanId = Number(vb.value);
        const suffix = vb.oid.slice(cVidTable.length + 1);
        const mode = modeBySuffix.get(suffix) ?? 0;

        const finalVlan =
          vlanId > 0 && vlanId <= 4094 ? vlanId : userVidBySuffix.get(suffix);
        if (!finalVlan) continue;

        const key = `${parsed.frame}:${parsed.slot}:${parsed.port}:${parsed.onuIndex}`;
        // Untuk multi service-port per ONU, ambil yang pertama valid.
        // Prefer service-port dengan tag/tls mode (>= 4) atau apapun yg pertama.
        const existing = result.get(key);
        if (!existing) {
          result.set(key, { vlanId: finalVlan, serviceMode: mode });
        }
      }

      logger.info(
        `[ZteAdapter] Discovered service-port VLANs for ${result.size} ONUs on ${device.name}`,
      );
      return { success: true, data: result };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "unknown";
      logger.error(`[ZteAdapter] discoverServicePortVlans error: ${msg}`);
      return this.snmpFailure(error, "SNMP walk service-port failed");
    }
  }

  /**
   * Walk SNMP ZXGPON phase state table untuk pull status real per ONU.
   * Branch ini BEDA dari ZTE-AN — pakai encoding ifIndex sendiri.
   *
   * Status values: 3=working, 4=dying_gasp, 6=offline.
   * Return Map keyed by `${frame}:${slot}:${port}:${onuIndex}` ke OnuStatus.
   */
  async discoverOnuPhaseStates(
    device: OltDevice,
  ): Promise<ServiceResult<Map<string, OnuStatusInfo["status"]>>> {
    try {
      const baseOid = ZteOidRegistry.zxGpon.onuPhaseStateTable;
      const varbinds = await this.snmp.walk(device, baseOid);

      const result = new Map<string, OnuStatusInfo["status"]>();
      for (const vb of varbinds) {
        const parsed = ZteOidRegistry.parseZxGponOnuIndex(vb.oid, baseOid);
        if (!parsed) continue;

        const stateValue = Number(vb.value);
        const stateLabel = (ZteOidRegistry.statusMap[stateValue] ??
          "unknown") as OnuStatusInfo["status"];

        const key = `${parsed.frame}:${parsed.slot}:${parsed.port}:${parsed.onuIndex}`;
        result.set(key, stateLabel);
      }

      logger.info(
        `[ZteAdapter] Discovered phase state for ${result.size} ONUs on ${device.name}`,
      );
      return { success: true, data: result };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "unknown";
      logger.error(`[ZteAdapter] discoverOnuPhaseStates error: ${msg}`);
      return this.snmpFailure(error, "SNMP walk phase state failed");
    }
  }

  /**
   * Walk SNMP RX+TX power tables untuk seluruh ONU di OLT.
   * Branch ZXGPON-MIB (verified C300 V2.1.0):
   *   .1012.3.50.12.1.1.10 = ONU RX (downstream)
   *   .1012.3.50.12.1.1.14 = ONU TX (upstream)
   * Decode: raw * 0.002 - 30 = dBm.
   *
   * Return Map keyed by `${frame}:${slot}:${port}:${onuIndex}` ke
   * { rxPower, txPower } dalam dBm.
   */
  async discoverOnuRxPowers(
    device: OltDevice,
  ): Promise<
    ServiceResult<
      Map<string, { rxPower: number | null; txPower: number | null }>
    >
  > {
    try {
      const rxBase = ZteOidRegistry.zxGponOnuPower.onuRxPowerTable;
      const txBase = ZteOidRegistry.zxGponOnuPower.onuTxPowerTable;

      const [rxVarbinds, txVarbinds] = await Promise.all([
        this.snmp.walk(device, rxBase),
        this.snmp.walk(device, txBase),
      ]);

      // OID format: <base>.<ifIndex>.<onuIndex>.1
      // Parser butuh suffix 2-segment (bukan 1) — pakai parseZxGpon
      // dan strip trailing .1
      const result = new Map<
        string,
        { rxPower: number | null; txPower: number | null }
      >();

      const parsePower = (
        varbinds: ReturnType<typeof this.snmp.walk> extends Promise<infer T>
          ? T
          : never,
        base: string,
      ): Map<string, number | null> => {
        const map = new Map<string, number | null>();
        for (const vb of varbinds) {
          const suffix = vb.oid.slice(base.length + 1);
          const parts = suffix.split(".").map(Number);
          if (parts.length < 2 || parts.some((n) => isNaN(n))) continue;
          const ifIndex = parts[0];
          const onuIndex = parts[1];
          const decoded = ZteOidRegistry.decodeZxGponIfIndex(ifIndex);
          if (!decoded) continue;
          const dbm = this.decodeZxGponPower(Number(vb.value));
          const key = `${decoded.frame}:${decoded.slot}:${decoded.port}:${onuIndex}`;
          map.set(key, dbm);
        }
        return map;
      };

      const rxMap = parsePower(rxVarbinds, rxBase);
      const txMap = parsePower(txVarbinds, txBase);

      const allKeys = new Set([...rxMap.keys(), ...txMap.keys()]);
      for (const key of allKeys) {
        result.set(key, {
          rxPower: rxMap.get(key) ?? null,
          txPower: txMap.get(key) ?? null,
        });
      }

      logger.info(
        `[ZteAdapter] Discovered optical power for ${result.size} ONUs on ${device.name}`,
      );
      return { success: true, data: result };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "unknown";
      logger.error(`[ZteAdapter] discoverOnuRxPowers error: ${msg}`);
      return this.snmpFailure(error, "SNMP walk optical power failed");
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
      return this.snmpFailure(error, "Search failed");
    }
  }

  /**
   * Walk SNMP `registeredOnuNameTable` (kolom .2) untuk enumerasi
   * (oltIfIndex, onuIndex) seluruh ONU yang teregistrasi di OLT,
   * lalu walk kolom .6 untuk pull SN tiap entry.
   *
   * Verified di C300 V2.1.0 lapangan:
   *   .500.10.2.3.3.1.2.<ifIndex>.<onuIndex> = description string
   *   .500.10.2.3.3.1.6.<ifIndex>.<onuIndex> = SN raw bytes
   *
   * Plus walk ZXGPON branch (.1012.x) untuk tambahan info:
   *   - vendor, model, software version
   *   - distance dalam meter
   */
  async discoverRegisteredOnus(
    device: OltDevice,
  ): Promise<ServiceResult<DiscoveredRegisteredOnu[]>> {
    try {
      const nameTable = ZteOidRegistry.gpon.registeredOnuNameTable;
      const serialTable = ZteOidRegistry.gpon.registeredOnuSerialTable;
      const vendorTable = ZteOidRegistry.zxGpon.onuVendorTable;
      const modelTable = ZteOidRegistry.zxGpon.onuModelTable;
      const swVersionTable = ZteOidRegistry.zxGpon.onuSoftwareVersionTable;
      const distanceTable = ZteOidRegistry.zxGpon.onuDistanceTable;

      const [
        nameVarbinds,
        serialVarbinds,
        vendorVarbinds,
        modelVarbinds,
        swVarbinds,
        distVarbinds,
      ] = await Promise.all([
        this.snmp.walk(device, nameTable),
        this.snmp.walk(device, serialTable),
        this.snmp.walk(device, vendorTable),
        this.snmp.walk(device, modelTable),
        this.snmp.walk(device, swVersionTable),
        this.snmp.walk(device, distanceTable),
      ]);

      logger.info(
        `[ZteAdapter] Walk result: name=${nameVarbinds.length} serial=${serialVarbinds.length} vendor=${vendorVarbinds.length} model=${modelVarbinds.length}`,
      );

      // Build maps by ZXGPON key (frame:slot:port:onuIndex) untuk merge
      const byZxKey = (
        varbinds: typeof nameVarbinds,
        base: string,
        valueDecoder: (v: unknown) => string | number | null,
      ) => {
        const map = new Map<string, string | number>();
        for (const vb of varbinds) {
          const suffix = vb.oid.slice(base.length + 1);
          const parts = suffix.split(".").map(Number);
          if (parts.length < 2 || parts.some((n) => isNaN(n))) continue;
          const ifIndex = parts[0];
          const onuIndex = parts[1];
          const decoded = ZteOidRegistry.decodeZxGponIfIndex(ifIndex);
          if (!decoded) continue;
          const value = valueDecoder(vb.value);
          if (value === null) continue;
          const key = `${decoded.frame}:${decoded.slot}:${decoded.port}:${onuIndex}`;
          map.set(key, value);
        }
        return map;
      };

      const vendorMap = byZxKey(vendorVarbinds, vendorTable, (v) =>
        this.extractStringValue(v),
      );
      const modelMap = byZxKey(modelVarbinds, modelTable, (v) =>
        this.extractStringValue(v),
      );
      const swMap = byZxKey(swVarbinds, swVersionTable, (v) =>
        this.extractStringValue(v),
      );
      const distMap = byZxKey(distVarbinds, distanceTable, (v) => {
        const n = Number(v);
        return isNaN(n) ? null : n;
      });

      const serialBySuffix = new Map<string, string>();
      for (const vb of serialVarbinds) {
        const suffix = vb.oid.slice(serialTable.length + 1);
        const sn = this.extractSerialNumber(vb.value);
        if (sn) serialBySuffix.set(suffix, sn);
      }

      const onus: DiscoveredRegisteredOnu[] = [];
      let parseFailCount = 0;
      let serialMissCount = 0;
      for (const vb of nameVarbinds) {
        const parsed = ZteOidRegistry.parseOnuIndex(vb.oid, nameTable);
        if (!parsed) {
          parseFailCount++;
          continue;
        }

        const suffix = vb.oid.slice(nameTable.length + 1);
        const serialNumber = serialBySuffix.get(suffix);
        if (!serialNumber) {
          serialMissCount++;
          continue;
        }

        const description = this.extractStringValue(vb.value);
        const zxKey = `${parsed.slotFrame}:${parsed.slot}:${parsed.port}:${parsed.onuIndex}`;
        const vendor = (vendorMap.get(zxKey) as string) ?? null;
        const model = (modelMap.get(zxKey) as string) ?? null;
        const softwareVersion = (swMap.get(zxKey) as string) ?? null;
        const distance = (distMap.get(zxKey) as number) ?? null;

        onus.push({
          serialNumber,
          slotFrame: parsed.slotFrame,
          slot: parsed.slot,
          ponPort: parsed.port,
          onuIndex: parsed.onuIndex,
          description,
          vendor,
          model,
          softwareVersion,
          distance,
        });
      }

      logger.info(
        `[ZteAdapter] Match result: matched=${onus.length}, parseFailed=${parseFailCount}, serialMiss=${serialMissCount}`,
      );

      logger.info(
        `[ZteAdapter] Imported ${onus.length} registered ONUs from ${device.name}`,
      );
      return { success: true, data: onus };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "unknown";
      logger.error(`[ZteAdapter] discoverRegisteredOnus error: ${msg}`);
      return this.snmpFailure(error, "SNMP walk registered ONU failed");
    }
  }

  async registerOnu(
    device: OltDevice,
    params: RegisterOnuParams,
  ): Promise<ServiceResult<RegisteredOnu>> {
    return this.runTelnet(device, async (telnet) => {
      const ponInterface = ZteOidRegistry.formatPonInterface(
        device.defaultSlotFrame,
        device.defaultSlot,
        params.ponPort,
      );
      const onuIndex = params.onuIndex ?? 1;
      const onuInterface = ZteOidRegistry.formatOnuInterface(
        device.defaultSlotFrame,
        device.defaultSlot,
        params.ponPort,
        onuIndex,
      );

      // ── Step 1: BIND di PON-OLT interface (mandatory) ────────────────
      // Verified syntax C300: `onu N type ALL sn X`
      await telnet.executeAndAssertSuccess(`interface ${ponInterface}`);
      await telnet.executeAndAssertSuccess(
        `onu ${onuIndex} type ALL sn ${params.serialNumber}`,
      );
      await telnet.executeAndAssertSuccess(`exit`);

      // ── Step 2: PROVISIONING di GPON-ONU interface (best-effort) ─────
      // Tipe failure di sini tidak boleh menggagalkan register karena
      // bind sudah sukses. User bisa atur VLAN manual via "Set VLAN".
      if (params.vlanId !== undefined) {
        await this.provisionOnuServices(telnet, {
          onuInterface,
          vlanId: params.vlanId,
          bandwidthProfile: params.bandwidthProfile,
        }).catch((error) => {
          const msg =
            error instanceof Error ? error.message : "provisioning failed";
          logger.warn(
            `[ZteAdapter] ONU ${params.serialNumber} bound tapi provisioning gagal: ${msg}. ONU bisa diatur manual via "Set VLAN".`,
          );
        });
      }

      logger.info(
        `[ZteAdapter] Registered ONU ${params.serialNumber} on port ${params.ponPort}:${onuIndex}`,
      );
      return {
        ponPort: params.ponPort,
        onuIndex,
        serialNumber: params.serialNumber,
      };
    });
  }

  /**
   * Konfigurasi T-CONT, GEM port, service-port di **interface gpon-onu_X**
   * mode (bukan pon-onu-mng). Verified via `(config-if)#?` di C300:
   * tcont, gemport, service-port, vport semua tersedia di mode ini.
   */
  private async provisionOnuServices(
    telnet: ZteTelnetClient,
    args: {
      onuInterface: string;
      vlanId: number;
      bandwidthProfile?: string;
    },
  ): Promise<void> {
    const { onuInterface, vlanId, bandwidthProfile } = args;

    await telnet.executeAndAssertSuccess(`interface ${onuInterface}`);
    if (bandwidthProfile) {
      await telnet.executeAndAssertSuccess(
        `tcont ${DEFAULT_TCONT_INDEX} profile ${bandwidthProfile}`,
      );
    }
    await telnet.executeAndAssertSuccess(
      `gemport ${DEFAULT_GEMPORT_INDEX} tcont ${DEFAULT_TCONT_INDEX}`,
    );
    // service-port di interface mode (config-if context, ONU sudah tahu
    // siapa dirinya jadi tidak perlu reference vport eksternal)
    await telnet.executeAndAssertSuccess(
      `service-port ${DEFAULT_SERVICE_PORT_INDEX} user-vlan ${vlanId} vlan ${vlanId}`,
    );
    await telnet.executeAndAssertSuccess(`exit`);
  }

  async deregisterOnu(
    device: OltDevice,
    params: DeregisterOnuParams,
  ): Promise<ServiceResult<void>> {
    return this.runTelnet(device, async (telnet) => {
      const ponInterface = ZteOidRegistry.formatPonInterface(
        device.defaultSlotFrame,
        device.defaultSlot,
        params.ponPort,
      );
      const onuInterface = ZteOidRegistry.formatOnuInterface(
        device.defaultSlotFrame,
        device.defaultSlot,
        params.ponPort,
        params.onuIndex,
      );

      // Best-effort cleanup di gpon-onu interface
      await telnet.execute(`interface ${onuInterface}`);
      await telnet.execute(`no service-port ${DEFAULT_SERVICE_PORT_INDEX}`);
      await telnet.execute(`no gemport ${DEFAULT_GEMPORT_INDEX}`);
      await telnet.execute(`no tcont ${DEFAULT_TCONT_INDEX}`);
      await telnet.execute(`exit`);

      // Mandatory: unbind ONU di gpon-olt interface
      await telnet.executeAndAssertSuccess(`interface ${ponInterface}`);
      await telnet.executeAndAssertSuccess(`no onu ${params.onuIndex}`);
      await telnet.executeAndAssertSuccess(`exit`);

      logger.info(
        `[ZteAdapter] Deregistered ONU at port ${params.ponPort}:${params.onuIndex}`,
      );
    });
  }

  async disableOnu(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<void>> {
    return this.runTelnet(device, async (telnet) => {
      const onuInterface = ZteOidRegistry.formatOnuInterface(
        device.defaultSlotFrame,
        device.defaultSlot,
        ponPort,
        onuIndex,
      );
      await telnet.executeAndAssertSuccess(`interface ${onuInterface}`);
      await telnet.executeAndAssertSuccess("shutdown");
      await telnet.executeAndAssertSuccess("exit");
      logger.info(`[ZteAdapter] Disabled ONU at port ${ponPort}:${onuIndex}`);
    });
  }

  async enableOnu(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<void>> {
    return this.runTelnet(device, async (telnet) => {
      const onuInterface = ZteOidRegistry.formatOnuInterface(
        device.defaultSlotFrame,
        device.defaultSlot,
        ponPort,
        onuIndex,
      );
      await telnet.executeAndAssertSuccess(`interface ${onuInterface}`);
      await telnet.executeAndAssertSuccess("no shutdown");
      await telnet.executeAndAssertSuccess("exit");
      logger.info(`[ZteAdapter] Enabled ONU at port ${ponPort}:${onuIndex}`);
    });
  }

  async resetOnu(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<void>> {
    return this.runTelnet(device, async (telnet) => {
      const onuInterface = ZteOidRegistry.formatOnuInterface(
        device.defaultSlotFrame,
        device.defaultSlot,
        ponPort,
        onuIndex,
      );
      // C300: `clear` di gpon-onu interface mode untuk reset ONU.
      await telnet.executeAndAssertSuccess(`interface ${onuInterface}`);
      await telnet.executeAndAssertSuccess("clear");
      await telnet.executeAndAssertSuccess("exit");
      logger.info(`[ZteAdapter] Reset ONU at port ${ponPort}:${onuIndex}`);
    });
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
    return this.runTelnet(device, async (telnet) => {
      const onuInterface = ZteOidRegistry.formatOnuInterface(
        device.defaultSlotFrame,
        device.defaultSlot,
        params.ponPort,
        params.onuIndex,
      );
      const userVlan =
        params.vlanMode === "transparent" ? "untagged" : `${params.vlanId}`;

      await telnet.executeAndAssertSuccess(`interface ${onuInterface}`);
      await telnet.executeAndAssertSuccess(
        `service-port ${DEFAULT_SERVICE_PORT_INDEX} user-vlan ${userVlan} vlan ${params.vlanId}`,
      );
      await telnet.executeAndAssertSuccess("exit");

      logger.info(
        `[ZteAdapter] Set VLAN ${params.vlanId} on port ${params.ponPort}:${params.onuIndex}`,
      );
    });
  }

  async removeOnuVlan(
    device: OltDevice,
    params: RemoveVlanParams,
  ): Promise<ServiceResult<void>> {
    return this.runTelnet(device, async (telnet) => {
      const onuInterface = ZteOidRegistry.formatOnuInterface(
        device.defaultSlotFrame,
        device.defaultSlot,
        params.ponPort,
        params.onuIndex,
      );

      await telnet.executeAndAssertSuccess(`interface ${onuInterface}`);
      await telnet.execute(`no service-port ${DEFAULT_SERVICE_PORT_INDEX}`);
      await telnet.executeAndAssertSuccess("exit");

      logger.info(
        `[ZteAdapter] Removed VLAN on port ${params.ponPort}:${params.onuIndex}`,
      );
    });
  }

  async getOnuStatus(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<OnuStatusInfo>> {
    try {
      const statusOid = ZteOidRegistry.gpon.onuStatus(
        device.defaultSlotFrame,
        device.defaultSlot,
        ponPort,
        onuIndex,
      );
      const snOid = ZteOidRegistry.gpon.onuSerialNumber(
        device.defaultSlotFrame,
        device.defaultSlot,
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
      return this.snmpFailure(error, "SNMP get failed");
    }
  }

  async getOnuOpticalPower(
    device: OltDevice,
    ponPort: number,
    onuIndex: number,
  ): Promise<ServiceResult<OpticalPower>> {
    // SNMP-only via ZXGPON-MIB. Verified di C300 V2.1.0 lapangan:
    //   RX (downstream, what ONU receives): .1012.3.50.12.1.1.10
    //   TX (upstream, what ONU transmits):  .1012.3.50.12.1.1.14
    // Format: <branch>.<oltIfIndex>.<onuIndex>.1
    // Decode: raw * 0.002 - 30 = dBm
    // Sentinel: raw >= 30000 atau 65535 = no signal/offline.
    try {
      const zxIfIndex = ZteOidRegistry.encodeZxGponIfIndex(
        device.defaultSlot,
        ponPort,
      );
      const rxOid = `${ZteOidRegistry.zxGponOnuPower.onuRxPowerTable}.${zxIfIndex}.${onuIndex}.1`;
      const txOid = `${ZteOidRegistry.zxGponOnuPower.onuTxPowerTable}.${zxIfIndex}.${onuIndex}.1`;

      const results = await this.snmp.get(device, [rxOid, txOid]);
      const rxRaw = Number(results[0]?.value);
      const txRaw = Number(results[1]?.value);

      const rxPower = this.decodeZxGponPower(rxRaw);
      const txPower = this.decodeZxGponPower(txRaw);

      return {
        success: true,
        data: { rxPower, txPower },
      };
    } catch (error) {
      return this.snmpFailure(error, "SNMP get optical power failed");
    }
  }

  /**
   * Decode raw INTEGER ZXGPON optical power ke dBm.
   * Formula verified C300 V2.1.0:
   *   raw 3314  → -23.372 dBm (matches `show pon power att`)
   *   raw 16138 → +2.276 dBm
   * Sentinel >=30000 atau 65535 = no signal → null.
   */
  private decodeZxGponPower(raw: number): number | null {
    if (isNaN(raw)) return null;
    if (raw >= 30000) return null; // sentinel: no signal
    return Number((raw * 0.002 - 30).toFixed(3));
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
      return this.snmpFailure(error, "SNMP walk failed");
    }
  }

  private async runTelnet<T>(
    device: OltDevice,
    fn: (telnet: ZteTelnetClient) => Promise<T>,
  ): Promise<ServiceResult<T>> {
    const telnet = new ZteTelnetClient();
    try {
      await telnet.connect(device);
      await telnet.configMode(device);

      const data = await fn(telnet);

      await telnet.exitConfig();
      await telnet.disconnect();

      return { success: true, data: data as T };
    } catch (error) {
      await telnet.disconnect();
      const msg =
        error instanceof Error ? error.message : "Telnet operation failed";
      logger.error(`[ZteAdapter] Telnet operation failed: ${msg}`);
      return {
        success: false,
        error: msg,
        code: this.classifyTelnetError(error, msg),
      };
    }
  }

  private classifyTelnetError(error: unknown, msg: string): string {
    if (msg.includes("Command rejected")) return "COMMAND_REJECTED";
    if (msg.toLowerCase().includes("timeout")) return "TIMEOUT";
    if (
      error instanceof Error &&
      /econnreset|epipe|connection (?:lost|closed)/i.test(error.message)
    ) {
      return "CONNECTION_LOST";
    }
    return "TELNET_ERROR";
  }

  private classifyConnectionError(error: unknown): string {
    if (!(error instanceof Error)) return "CONNECTION_FAILED";
    if (/timeout/i.test(error.message)) return "TIMEOUT";
    return "CONNECTION_FAILED";
  }

  private snmpFailure<T>(error: unknown, fallback: string): ServiceResult<T> {
    const msg = error instanceof Error ? error.message : fallback;
    const code = /timeout/i.test(msg) ? "TIMEOUT" : "SNMP_ERROR";
    return { success: false, error: msg, code };
  }

  /**
   * Extract string dari OCTET STRING SNMP value. Library net-snmp
   * sering return OCTET STRING sebagai Buffer untuk binary data, dan
   * sebagai string untuk ASCII printable. Kita normalisasi keduanya
   * jadi string utf-8.
   */
  private extractStringValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (Buffer.isBuffer(value)) {
      const decoded = (value as Buffer).toString("utf-8").trim();
      return decoded.length > 0 ? decoded : null;
    }
    const str = String(value).trim();
    return str.length > 0 ? str : null;
  }

  /**
   * Extract Serial Number ONU dari value SNMP.
   *
   * GPON ONU SN format (ITU-T standard): 8 byte raw =
   *   4 byte ASCII vendor ID (mis. "ZTEG", "GGCL", "HWTC") +
   *   4 byte hex code unik per ONU.
   *
   * Saat di-encode di SNMP, value sering dikirim sebagai 8-byte octet
   * string. Kita decode jadi format CLI standar (ASCII vendor + hex code)
   * yang sama dengan output `show running-config interface gpon-olt_X`.
   *
   * Contoh:
   *   Buffer hex "5a544547cafffc3f" → "ZTEGCAFFFC3F"
   *     (ZTEG ASCII + CAFFFC3F hex)
   *   Buffer hex "4747434c073cd8f3" → "GGCL073CD8F3"
   *     (GGCL ASCII + 073CD8F3 hex)
   *
   * Kalau bukan format8-byte standar (mis. firmware lama yang return
   * full ASCII string), fallback ke hex/string biasa.
   */
  private extractSerialNumber(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (Buffer.isBuffer(value)) {
      const buf = value as Buffer;
      if (buf.length === 8) {
        const vendorId = buf.subarray(0, 4).toString("ascii");
        if (/^[A-Z]{4}$/.test(vendorId)) {
          const code = buf.subarray(4).toString("hex").toUpperCase();
          return vendorId + code;
        }
      }
      return buf.toString("hex").toUpperCase();
    }
    const str = String(value).trim();
    return str.length > 0 ? str : null;
  }

  async discoverCards(
    device: OltDevice,
  ): Promise<ServiceResult<DiscoveredCard[]>> {
    try {
      const typeResults = await this.snmp.walk(
        device,
        ZteOidRegistry.card.actualTypeTable,
      );

      if (!typeResults || typeResults.length === 0) {
        return { success: true, data: [] };
      }

      const statusResults = await this.snmp.walk(
        device,
        ZteOidRegistry.card.operStatus,
      );

      const statusBySlot = new Map<number, number>();
      for (const item of statusResults ?? []) {
        const slot = this.parseSlotSuffix(
          item.oid,
          ZteOidRegistry.card.operStatus,
        );
        if (slot !== null) {
          statusBySlot.set(slot, Number(item.value));
        }
      }

      const cards: DiscoveredCard[] = [];
      for (const item of typeResults) {
        const cardType = this.extractStringValue(item.value);
        if (!cardType) continue;

        const slot = this.parseSlotSuffix(
          item.oid,
          ZteOidRegistry.card.actualTypeTable,
        );
        if (slot === null) continue;

        const rawStatus = statusBySlot.get(slot);
        let status: DiscoveredCard["status"] = "ACTIVE";
        if (rawStatus === 2) status = "MAINTENANCE";
        else if (rawStatus !== undefined && rawStatus !== 1) status = "OFFLINE";

        cards.push({
          slotFrame: 1,
          slot,
          cardType,
          ponCount: this.inferPonCountFromCardType(cardType),
          status,
        });
      }

      return { success: true, data: cards };
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Card discovery failed";
      if (msg.toLowerCase().includes("timeout")) {
        return { success: false, error: msg, code: "SNMP_TIMEOUT" };
      }
      return { success: false, error: msg, code: "ADAPTER_ERROR" };
    }
  }

  private parseSlotSuffix(oid: string, baseOid: string): number | null {
    const suffix = oid.replace(baseOid + ".", "");
    const parts = suffix.split(".");
    // Suffix format: <rack>.<shelf>.<slot> (e.g. "1.1.7" = rack 1, shelf 1, slot 7)
    if (parts.length < 3) return null;
    const slot = parseInt(parts[2], 10);
    return isNaN(slot) ? null : slot;
  }

  private inferPonCountFromCardType(cardType: string): number {
    const upper = cardType.toUpperCase();
    if (/16/.test(upper)) return 16;
    if (/8/.test(upper)) return 8;
    if (/4/.test(upper)) return 4;
    return 8;
  }
}
