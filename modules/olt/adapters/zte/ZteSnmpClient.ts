import * as snmp from "net-snmp";
import { logger } from "@/lib/logger";
import type { OltDevice } from "../../domain/entities/olt-device.entity";

const SNMP_TIMEOUT = 10000;

export interface SnmpVarbind {
  oid: string;
  type: number;
  value: unknown;
}

export class ZteSnmpClient {
  private createSession(device: OltDevice): snmp.Session {
    return snmp.createSession(
      device.ipAddress,
      device.snmpCommunity ?? "public",
      {
        port: device.snmpPort,
        timeout: SNMP_TIMEOUT,
        version: snmp.Version2c,
      },
    );
  }

  async get(device: OltDevice, oids: string[]): Promise<SnmpVarbind[]> {
    const session = this.createSession(device);

    return new Promise((resolve, reject) => {
      session.get(oids, (error: Error | null, varbinds: snmp.Varbind[]) => {
        session.close();
        if (error) {
          logger.error(`[ZteSnmp] GET error: ${error.message}`);
          reject(error);
          return;
        }
        const results = varbinds.map((vb) => ({
          oid: vb.oid,
          type: vb.type,
          value: vb.value,
        }));
        resolve(results);
      });
    });
  }

  async walk(device: OltDevice, oid: string): Promise<SnmpVarbind[]> {
    const session = this.createSession(device);
    const results: SnmpVarbind[] = [];

    return new Promise((resolve, reject) => {
      session.subtree(
        oid,
        (varbinds: snmp.Varbind[]) => {
          for (const vb of varbinds) {
            results.push({ oid: vb.oid, type: vb.type, value: vb.value });
          }
        },
        (error: Error | null) => {
          session.close();
          if (error) {
            logger.error(`[ZteSnmp] WALK error: ${error.message}`);
            reject(error);
            return;
          }
          resolve(results);
        },
      );
    });
  }

  async testConnection(device: OltDevice): Promise<string> {
    const sysDescrOid = "1.3.6.1.2.1.1.1.0";
    const results = await this.get(device, [sysDescrOid]);
    if (results.length === 0) {
      throw new Error("Tidak ada response dari SNMP");
    }
    return String(results[0].value);
  }
}
