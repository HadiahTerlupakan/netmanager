import { logger } from "@/lib/logger";
import type { ServiceResult } from "../domain/ports/IOltAdapter";
import { OltRepository } from "../repositories/OltRepository";
import { ZteSnmpClient, type SnmpVarbind } from "../adapters/zte/ZteSnmpClient";

interface OidEntry {
  oid: string;
  type: number;
  value: string;
}

export class SnmpExplorerService {
  private oltRepo = new OltRepository();
  private snmpClient = new ZteSnmpClient();

  async walkOidTree(
    oltId: string,
    tenantId: string,
    baseOid: string,
  ): Promise<ServiceResult<OidEntry[]>> {
    const olt = await this.oltRepo.findById(oltId, tenantId);
    if (!olt) {
      return {
        success: false,
        error: "OLT tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    try {
      const varbinds = await this.snmpClient.walk(olt, baseOid);
      const entries: OidEntry[] = varbinds.map((vb) => ({
        oid: vb.oid,
        type: vb.type,
        value: this.formatValue(vb),
      }));

      logger.info(
        `[SnmpExplorer] Walk ${baseOid} on ${olt.name}: ${entries.length} entries`,
      );
      return { success: true, data: entries };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "SNMP walk failed";
      return { success: false, error: msg, code: "SNMP_ERROR" };
    }
  }

  async getOidValue(
    oltId: string,
    tenantId: string,
    oid: string,
  ): Promise<ServiceResult<OidEntry>> {
    const olt = await this.oltRepo.findById(oltId, tenantId);
    if (!olt) {
      return {
        success: false,
        error: "OLT tidak ditemukan",
        code: "NOT_FOUND",
      };
    }

    try {
      const results = await this.snmpClient.get(olt, [oid]);
      if (results.length === 0) {
        return { success: false, error: "No response", code: "SNMP_ERROR" };
      }

      const entry: OidEntry = {
        oid: results[0].oid,
        type: results[0].type,
        value: this.formatValue(results[0]),
      };
      return { success: true, data: entry };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "SNMP get failed";
      return { success: false, error: msg, code: "SNMP_ERROR" };
    }
  }

  private formatValue(vb: SnmpVarbind): string {
    if (Buffer.isBuffer(vb.value)) {
      const hex = (vb.value as Buffer).toString("hex").toUpperCase();
      const ascii = (vb.value as Buffer)
        .toString("ascii")
        .replace(/[^\x20-\x7E]/g, ".");
      return `HEX: ${hex} | ASCII: ${ascii}`;
    }
    return String(vb.value);
  }
}
