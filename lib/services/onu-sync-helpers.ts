/**
 * ONU Sync Helpers
 * Helper functions untuk ONU sync operations
 */

import { snmpGetBulkSimple } from '@/lib/utils/snmp-helpers'
import { ONU_OIDS } from '@/lib/utils/onu-oids'
import type { GponPortInfo } from '@/lib/types/onu-sync'

/**
 * Menghitung base index ONU secara matematis dari nama port GPON.
 * Contoh: gpon_1/9/13 -> base index
 */
export function calculateOnuBaseIndex(portName: string): number | null {
  const portMatch = portName.match(/^gpon_(\d+)\/(\d+)\/(\d+)$/i)
  if (!portMatch) return null

  const frame = parseInt(portMatch[1], 10)
  const slot = parseInt(portMatch[2], 10)
  const ponPort = parseInt(portMatch[3], 10)

  // Konstanta yang ditemukan dari investigasi OLT user
  // Ini adalah base index untuk slot 7, port 1
  const BASE_FOR_SLOT_7 = 268895552 // Corresponds to gpon_1/7/1

  // Rumus: Base_for_Slot_7 + (Slot-7)*256 + (Port-1)*16
  // Asumsi: frame selalu 1 untuk perhitungan ini
  const baseIndex = BASE_FOR_SLOT_7 + (slot - 7) * 256 + (ponPort - 1) * 16

  return baseIndex
}

/**
 * Membangun mapping GPON port dari IF-MIB ifName
 * Format: gpon_1/X/Y -> { ifIndex: number, baseIndex: number | null }
 */
export async function buildGponPortMap(
  ipAddress: string,
  port: number,
  community: string,
  version: string
): Promise<Map<string, GponPortInfo>> {
  console.log(`[C300-GPON-SNMP] Building GPON port map from IF-MIB ifName...`)
  
  const gponPortMap = new Map<string, GponPortInfo>()
  
  try {
    const ifNameData = await snmpGetBulkSimple(ipAddress, port, community, version, ONU_OIDS.IF_NAME, 300000)
    
    console.log(`[C300-GPON-SNMP] Found ${Object.keys(ifNameData).length} interfaces from IF-MIB`)
    
    for (const [oid, value] of Object.entries(ifNameData)) {
      const ifName = value.toString().trim()
      const gponMatch = ifName.match(/^gpon_(\d+\/\d+\/\d+)$/i)
      
      if (gponMatch) {
        const portName = `gpon_${gponMatch[1]}`
        const oidParts = oid.split('.')
        
        if (oidParts.length > 0) {
          const ifIndex = parseInt(oidParts[oidParts.length - 1], 10)
          if (!isNaN(ifIndex) && ifIndex > 0) {
            const baseIndex = calculateOnuBaseIndex(portName)
            gponPortMap.set(portName, { ifIndex, baseIndex })
          }
        }
      }
    }
    
    console.log(`[C300-GPON-SNMP] Built GPON port map: ${gponPortMap.size} GPON ports found`)
    
    // Log beberapa sample untuk debugging
    const samplePorts = Array.from(gponPortMap.entries()).slice(0, 10)
    console.log(`[C300-GPON-SNMP] Sample GPON ports:`)
    for (const [portName, portInfo] of samplePorts) {
      console.log(`[C300-GPON-SNMP]   ${portName} -> ifIndex: ${portInfo.ifIndex}, baseIndex: ${portInfo.baseIndex}`)
    }
    
    return gponPortMap
  } catch (error: any) {
    console.warn(`[C300-GPON-SNMP] Failed to build GPON port map: ${error.message || error}`)
    return gponPortMap
  }
}

/**
 * Build composite index dari frame/slot/port
 */
export function buildCompositeIndex(frame: number, slot: number, port: number): number {
  const type = 1
  const shelf = frame - 1
  const slotIdx = slot - 1
  const portIdx = port - 1
  return (type << 28) | (shelf << 24) | (slotIdx << 16) | (portIdx << 8) | 0
}

/**
 * Parse composite index ke frame/slot/port
 */
export function parseCompositeIndex(compositeIndex: number): { type: number; shelf: number; slot: number; port: number } | null {
  const type = (compositeIndex >> 28) & 0xF
  const shelf = (compositeIndex >> 24) & 0xF
  const slot = (compositeIndex >> 16) & 0xFF
  const port = (compositeIndex >> 8) & 0xFF
  
  if (type === 1 && slot > 0 && port > 0) {
    return { type, shelf, slot, port }
  }
  
  return null
}

/**
 * Parse gponOnu dari index
 */
export function parseGponOnu(idx: string): string {
  const indexParts = idx.split('.')
  if (indexParts.length >= 2) {
    const compositeIndex = parseInt(indexParts[0], 10)
    const onuId = indexParts[1]
    
    if (!isNaN(compositeIndex)) {
      const parsed = parseCompositeIndex(compositeIndex)
      if (parsed) {
        const frame = parsed.shelf === 0 ? 1 : parsed.shelf
        return `${frame}/${parsed.slot}/${parsed.port}:${onuId}`
      }
    }
  }
  
  return `idx-${idx}`
}

