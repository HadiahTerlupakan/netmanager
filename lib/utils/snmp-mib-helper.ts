/**
 * SNMP MIB Helper
 * Helper untuk mempermudah akses data SNMP menggunakan struktur MIB-like
 * Menggunakan definisi OID yang terstruktur untuk mempermudah parsing dan akses data
 */

import { snmpGet, snmpGetMultiple, snmpGetBulkSimple, snmpTable } from './snmp-helpers'
import { ONU_OIDS } from './onu-oids'

/**
 * Definisi MIB Table untuk ONU
 * Setiap table memiliki baseOid dan kolom-kolomnya
 */
export const ONU_MIB_TABLES = {
  // Status Table (zxGponOntStateTable)
  status: {
    baseOid: '1.3.6.1.4.1.3902.1012.3.28.2.1',
    columns: {
      index: '1',      // Composite index
      adminState: '2', // Admin state
      omccState: '3',  // OMCC state
      phaseState: '4', // Phase state (Status)
      channel: '5',    // Channel
    },
    description: 'ONU Status Table',
  },

  // Device Management Table (zxGponOntDevMgmtTable)
  device: {
    baseOid: '1.3.6.1.4.1.3902.1012.3.28.1.1',
    columns: {
      index: '1',
      name: '2',           // ONU Name
      serial: '5',          // Serial Number
      status: '6',          // Status (old)
      rxOlt: '7',          // RX OLT (old)
      tx: '9',             // TX
      registerTime: '12',   // Register Time
    },
    description: 'ONU Device Management Table',
  },

  // RX OLT Table (new method)
  rxOlt: {
    baseOid: '1.3.6.1.4.1.3902.1015.1010.11.2.1',
    columns: {
      index: '1',
      rxOlt: '2',          // RX OLT Power
    },
    description: 'ONU RX OLT Table',
  },

  // RX ONU Table
  rxOnu: {
    baseOid: '1.3.6.1.4.1.3902.1012.3.50.12.1.1',
    columns: {
      index: '1',
      rxOnu: '10',         // RX ONU Power
      txOnu: '11',         // TX ONU Power
    },
    description: 'ONU RX/TX Table',
  },

  // Description Table
  description: {
    baseOid: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1',
    columns: {
      index: '1',
      description: '3',    // Description
    },
    description: 'ONU Description Table',
  },
} as const

/**
 * Helper untuk mendapatkan data dari MIB table
 */
export class SNMPMIBHelper {
  /**
   * Fetch data dari SNMP table menggunakan definisi MIB
   */
  static async fetchTable(
    ipAddress: string,
    port: number,
    community: string,
    version: string,
    tableName: keyof typeof ONU_MIB_TABLES,
    columns: string[],
    timeout: number = 30000
  ): Promise<Record<string, string>> {
    const table = ONU_MIB_TABLES[tableName]
    if (!table) {
      throw new Error(`Table ${tableName} tidak ditemukan`)
    }

    // Gunakan snmpTable untuk fetch multiple columns sekaligus
    return await snmpTable(
      ipAddress,
      port,
      community,
      version,
      table.baseOid,
      columns,
      timeout
    )
  }

  /**
   * Fetch data untuk ONU tertentu menggunakan composite index dan onuId
   */
  static async fetchOnuData(
    ipAddress: string,
    port: number,
    community: string,
    version: string,
    compositeIndex: number,
    onuId: number,
    timeout: number = 30000
  ): Promise<{
    status?: string
    name?: string
    serial?: string
    rxOlt?: string
    rxOnu?: string
    description?: string
  }> {
    const results: Record<string, string> = {}

    // Build OIDs untuk ONU ini
    const oids = {
      status: `${ONU_MIB_TABLES.status.baseOid}.${ONU_MIB_TABLES.status.columns.phaseState}.${compositeIndex}.${onuId}`,
      name: `${ONU_MIB_TABLES.device.baseOid}.${ONU_MIB_TABLES.device.columns.name}.${compositeIndex}.${onuId}`,
      serial: `${ONU_MIB_TABLES.device.baseOid}.${ONU_MIB_TABLES.device.columns.serial}.${compositeIndex}.${onuId}`,
      rxOlt: `${ONU_MIB_TABLES.rxOlt.baseOid}.${ONU_MIB_TABLES.rxOlt.columns.rxOlt}.${compositeIndex}.${onuId}`,
      rxOnu: `${ONU_MIB_TABLES.rxOnu.baseOid}.${ONU_MIB_TABLES.rxOnu.columns.rxOnu}.${compositeIndex}.${onuId}`,
      description: `${ONU_MIB_TABLES.description.baseOid}.${ONU_MIB_TABLES.description.columns.description}.${compositeIndex}.${onuId}`,
    }

    // Fetch semua OIDs sekaligus menggunakan snmpGetMultiple
    const oidArray = Object.values(oids)
    const values = await snmpGetMultiple(ipAddress, port, community, version, oidArray, timeout)

    // Map hasil ke format yang lebih mudah
    const index = `${compositeIndex}.${onuId}`
    for (const [key, oid] of Object.entries(oids)) {
      if (values[oid]) {
        results[key] = values[oid]
      }
    }

    return results as any
  }

  /**
   * Fetch multiple ONUs menggunakan SNMP TABLE (lebih efisien)
   */
  static async fetchMultipleOnus(
    ipAddress: string,
    port: number,
    community: string,
    version: string,
    compositeIndex: number,
    onuIds: number[],
    timeout: number = 30000
  ): Promise<Record<number, {
    status?: string
    name?: string
    serial?: string
    rxOlt?: string
    rxOnu?: string
    description?: string
  }>> {
    const results: Record<number, any> = {}

    // Fetch semua table sekaligus menggunakan snmpTable
    const [statusTable, nameTable, serialTable, rxOltTable, rxOnuTable, descTable] = await Promise.all([
      this.fetchTable(ipAddress, port, community, version, 'status', ['4'], timeout),
      this.fetchTable(ipAddress, port, community, version, 'device', ['2'], timeout),
      this.fetchTable(ipAddress, port, community, version, 'device', ['5'], timeout),
      this.fetchTable(ipAddress, port, community, version, 'rxOlt', ['2'], timeout),
      this.fetchTable(ipAddress, port, community, version, 'rxOnu', ['10'], timeout),
      this.fetchTable(ipAddress, port, community, version, 'description', ['3'], timeout),
    ])

    // Filter dan group hasil berdasarkan onuId
    for (const onuId of onuIds) {
      const index = `${compositeIndex}.${onuId}`
      results[onuId] = {
        status: statusTable[`4.${index}`],
        name: nameTable[`2.${index}`],
        serial: serialTable[`5.${index}`],
        rxOlt: rxOltTable[`2.${index}`],
        rxOnu: rxOnuTable[`10.${index}`],
        description: descTable[`3.${index}`],
      }
    }

    return results
  }

  /**
   * Parse composite index dari gponOnu string
   * Format: "Frame/Slot/Port:OnuId" -> { frame, slot, port, onuId, compositeIndex }
   */
  static parseGponOnu(gponOnu: string): {
    frame: number
    slot: number
    port: number
    onuId: number
    compositeIndex: number
  } | null {
    const match = gponOnu.match(/^(\d+)\/(\d+)\/(\d+):(\d+)$/)
    if (!match) {
      return null
    }

    const [, frame, slot, port, onuId] = match.map(Number)
    
    // Calculate composite index: (frame * 256 * 256) + (slot * 256) + port
    const compositeIndex = (frame * 65536) + (slot * 256) + port

    return {
      frame,
      slot,
      port,
      onuId,
      compositeIndex,
    }
  }

  /**
   * Build full OID untuk field tertentu
   */
  static buildOid(
    tableName: keyof typeof ONU_MIB_TABLES,
    column: string,
    compositeIndex: number,
    onuId: number
  ): string {
    const table = ONU_MIB_TABLES[tableName]
    if (!table) {
      throw new Error(`Table ${tableName} tidak ditemukan`)
    }

    const columnOid = table.columns[column as keyof typeof table.columns]
    if (!columnOid) {
      throw new Error(`Column ${column} tidak ditemukan di table ${tableName}`)
    }

    return `${table.baseOid}.${columnOid}.${compositeIndex}.${onuId}`
  }
}

/**
 * Export helper functions untuk kemudahan penggunaan
 */
export const {
  fetchTable,
  fetchOnuData,
  fetchMultipleOnus,
  parseGponOnu,
  buildOid,
} = SNMPMIBHelper

