import { NextRequest, NextResponse } from 'next/server'
import { getOLTRepository, getOnuRepository } from '@/lib/repositories'
import { snmpGetBulkSimple, snmpTable } from '@/lib/utils/snmp-helpers'
import { ONU_OIDS } from '@/lib/utils/onu-oids'
import type { OnuSyncData } from '@/lib/types/onu-sync'
import { buildGponPortMap, buildCompositeIndex, parseCompositeIndex, parseGponOnu, decodeCompositeIndex } from '@/lib/services/onu-sync-helpers'
import { clearOnuCache } from '../route'
import { verifyAuth } from '@/lib/auth'
import {
  isValidName,
  isTimestamp,
  convertHexStringToAscii,
  convertHexToSerialNumber,
  parseStatus,
  parseRxOlt,
  parseRxOnu,
  parseTxOlt,
  parseTxOnu,
  parseRegisterTime,
  parseTimestamp,
  parseBigInt,
  parseName,
  parseDescription,
  parseSerialNumber,
  parseActualType,
  parsePppoe,
  parseMacAddress,
} from '@/lib/utils/onu-data-parsers'

// Re-export types dan functions dari helper modules
export type { OnuSyncData } from '@/lib/types/onu-sync'

// Cache system untuk sync ONU data
// Cache menyimpan hasil SNMP fetch untuk mengurangi beban pada OLT
// Cache key: kombinasi oltId dan IP address
// Cache TTL: 10 menit (data ONU tidak berubah terlalu sering, tapi sync sangat lambat)
interface SyncCacheEntry {
  onuData: Array<OnuSyncData>
  timestamp: number
  oltId: string
  oltIpAddress: string
}

const syncCache = new Map<string, SyncCacheEntry>()
const SYNC_CACHE_TTL = 10 * 60 * 1000 // 10 menit

/**
 * Generate cache key untuk sync ONU
 */
function getSyncCacheKey(oltId: string, ipAddress: string): string {
  return `sync:${oltId}:${ipAddress}`
}

/**
 * Get cached sync data
 */
function getCachedSyncData(oltId: string, ipAddress: string): Array<OnuSyncData> | null {
  const cacheKey = getSyncCacheKey(oltId, ipAddress)
  const entry = syncCache.get(cacheKey)

  if (!entry) {
    return null
  }

  const now = Date.now()
  if (now - entry.timestamp > SYNC_CACHE_TTL) {
    syncCache.delete(cacheKey)
    console.log(`[All-ONU-Cache] Cache expired for OLT ${oltId} (${ipAddress})`)
    return null
  }

  const ageSeconds = Math.round((now - entry.timestamp) / 1000)
  console.log(`[All-ONU-Cache] Cache hit for OLT ${oltId} (${ipAddress}) - ${entry.onuData.length} ONUs (age: ${ageSeconds}s)`)
  return entry.onuData
}

/**
 * Set cached sync data
 */
function setCachedSyncData(oltId: string, ipAddress: string, onuData: Array<OnuSyncData>): void {
  const cacheKey = getSyncCacheKey(oltId, ipAddress)
  syncCache.set(cacheKey, {
    onuData,
    timestamp: Date.now(),
    oltId,
    oltIpAddress: ipAddress,
  })
  console.log(`[All-ONU-Cache] Cached ${onuData.length} ONUs for OLT ${oltId} (${ipAddress}) - TTL: ${SYNC_CACHE_TTL / 1000 / 60} minutes`)
}

/**
 * Clear cache untuk OLT tertentu atau semua cache
 */
export function clearSyncCache(oltId?: string): void {
  if (oltId) {
    // Clear cache untuk OLT tertentu
    const keysToDelete: string[] = []
    for (const [key, entry] of syncCache.entries()) {
      if (entry.oltId === oltId) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => syncCache.delete(key))
    console.log(`[All-ONU-Cache] Cleared cache for OLT ${oltId} (${keysToDelete.length} entries)`)
  } else {
    // Clear semua cache
    const count = syncCache.size
    syncCache.clear()
    console.log(`[All-ONU-Cache] Cleared all sync cache (${count} entries)`)
  }
}

/**
 * Menghitung jumlah ONU dari OLT via SNMP (hanya count, tidak ambil semua data)
 * Fungsi ini menggunakan getNext untuk memastikan akurasi dan konsistensi
 * @returns Jumlah ONU yang ditemukan
 */
export async function countOnuFromSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string
): Promise<number> {
  console.log(`[C300-GPON-SNMP-Count] Counting ONUs from OLT (${ipAddress}) via SNMP...`)
  console.log(`[C300-GPON-SNMP-Count] Using OID: ${ONU_OIDS.STATUS_NEW}`)
  console.log(`[C300-GPON-SNMP-Count] Using GETBULK first, then GET NEXT if needed to handle fragmented data`)
  console.log(`[C300-GPON-SNMP-Count] Timeout: 300000ms (5 minutes) to ensure all ONUs are counted`)

  try {
    // Gunakan GETBULK terlebih dahulu karena lebih cepat untuk counting
    const { snmpGetBulkSimple, snmpWalkWithGetNext } = await import('@/lib/utils/snmp-helpers')
    const statusData = await snmpGetBulkSimple(ipAddress, port, community, version, ONU_OIDS.STATUS_NEW, 300000)
    let count = Object.keys(statusData).length

    console.log(`[C300-GPON-SNMP-Count] GETBULK found ${count} ONUs`)

    // Jika count terlalu kecil atau terputus-putus, gunakan GET NEXT untuk memastikan semua data terambil
    if (count > 0 && count < 500) {
      console.log(`[C300-GPON-SNMP-Count] Count seems low (${count}), using GET NEXT to handle fragmented data...`)
      try {
        const getNextResults = await snmpWalkWithGetNext(
          ipAddress,
          port,
          community,
          version,
          ONU_OIDS.STATUS_NEW,
          300000
        )

        const getNextCount = getNextResults.length
        console.log(`[C300-GPON-SNMP-Count] GET NEXT found ${getNextCount} ONUs (vs ${count} from GETBULK)`)

        if (getNextCount > count) {
          count = getNextCount
          console.log(`[C300-GPON-SNMP-Count] Using GET NEXT count: ${count} ONUs`)
        }
      } catch (getNextError: any) {
        console.warn(`[C300-GPON-SNMP-Count] GET NEXT failed: ${getNextError.message || getNextError}, using GETBULK count`)
      }
    }

    console.log(`[C300-GPON-SNMP-Count] Final count: ${count} ONUs on OLT ${ipAddress}`)

    // Warning jika count terlalu kecil (kemungkinan tidak semua data terambil)
    if (count > 0 && count < 100) {
      console.warn(`[C300-GPON-SNMP-Count] WARNING: Only ${count} ONUs found. This might be incomplete. Expected 600+ ONUs.`)
    }

    return count
  } catch (error: any) {
    console.warn(`[C300-GPON-SNMP-Count] Failed to count ONUs: ${error.message || error}`)
    console.warn(`[C300-GPON-SNMP-Count] Returning 0 - will retry on next sync`)
    return 0
  }
}

/**
 * Helper function untuk memproses ONU data dari index
 * Mengembalikan OnuSyncData object
 */
function processOnuDataFromIndex(
  idx: string,
  oltId: string,
  statusNew: Record<string, string>,
  status: Record<string, string>,
  name: Record<string, string>,
  desc: Record<string, string>,
  sn: Record<string, string>,
  rx: Record<string, string>,
  tx: Record<string, string>,
  reg: Record<string, string>,
  pppoe: Record<string, string>,
  rxOltData: Record<string, string>,
  rxOnuNew: Record<string, string>,
  txOnuNew: Record<string, string>,
  actualType: Record<string, string>,
  zteAnPonData: Record<string, Record<string, string>>
): OnuSyncData {
  // Parse index untuk mendapatkan gponOnu menggunakan helper function
  const gponOnu = parseGponOnu(idx)

  // Prioritas: status baru, fallback: status lama
  const statusValueNew = statusNew[idx] || ""
  const statusValue = status[idx] || ""
  const rxValue = rx[idx] || ""  // RX OLT (metode lama, fallback)

  // RX OLT: coba beberapa format index dengan lebih agresif
  let rxOltNewValue = rxOltData[idx] || ""  // RX OLT (metode baru)

  if (!rxOltNewValue) {
    const idxWithOne = `${idx}.1`
    rxOltNewValue = rxOltData[idxWithOne] || ""
  }

  if (!rxOltNewValue) {
    const indexParts = idx.split('.')
    if (indexParts.length >= 2) {
      const compositeIndex = indexParts[0]
      const onuId = indexParts[1]
      const matchingKeys = Object.keys(rxOltData).filter(k => k.startsWith(`${compositeIndex}.`))
      if (matchingKeys.length > 0) {
        const exactMatch = matchingKeys.find(k => {
          const kParts = k.split('.')
          return kParts.length >= 2 && kParts[1] === onuId
        })
        if (exactMatch) {
          rxOltNewValue = rxOltData[exactMatch] || ""
        } else {
          const exactMatchWithOne = matchingKeys.find(k => {
            const kParts = k.split('.')
            return kParts.length >= 3 && kParts[1] === onuId && kParts[2] === '1'
          })
          if (exactMatchWithOne) {
            rxOltNewValue = rxOltData[exactMatchWithOne] || ""
          } else {
            rxOltNewValue = rxOltData[matchingKeys[0]] || ""
          }
        }
      }
    }
  }

  if (!rxOltNewValue) {
    const indexParts = idx.split('.')
    if (indexParts.length >= 2) {
      const onuId = indexParts[1]
      const matchingKeys = Object.keys(rxOltData).filter(k => {
        const kParts = k.split('.')
        return kParts.length >= 2 && (kParts[kParts.length - 1] === onuId || kParts[kParts.length - 2] === onuId)
      })
      if (matchingKeys.length > 0) {
        rxOltNewValue = rxOltData[matchingKeys[0]] || ""
      }
    }
  }

  // RX ONU
  let rxOnuNewValue = rxOnuNew[idx] || ""
  if (!rxOnuNewValue) {
    const idxWithOne = `${idx}.1`
    rxOnuNewValue = rxOnuNew[idxWithOne] || ""
  }
  if (!rxOnuNewValue) {
    const indexParts = idx.split('.')
    if (indexParts.length >= 2) {
      const compositeIndex = indexParts[0]
      const onuId = indexParts[1]
      const idxWithOne = `${compositeIndex}.${onuId}.1`
      rxOnuNewValue = rxOnuNew[idxWithOne] || ""
      if (!rxOnuNewValue) {
        const idxWithoutOne = `${compositeIndex}.${onuId}`
        rxOnuNewValue = rxOnuNew[idxWithoutOne] || ""
      }
    }
  }
  if (!rxOnuNewValue) {
    const indexParts = idx.split('.')
    if (indexParts.length >= 2) {
      const onuId = indexParts[1]
      const matchingKeys = Object.keys(rxOnuNew).filter(k => {
        const parts = k.split('.')
        return parts.length >= 2 && (parts[parts.length - 1] === onuId || parts[parts.length - 2] === onuId)
      })
      if (matchingKeys.length > 0) {
        const compositeIndex = indexParts[0]
        const closestMatch = matchingKeys.find(k => k.startsWith(`${compositeIndex}.`))
        if (closestMatch) {
          rxOnuNewValue = rxOnuNew[closestMatch] || ""
        } else {
          rxOnuNewValue = rxOnuNew[matchingKeys[0]] || ""
        }
      }
    }
  }

  const txValue = tx[idx] || ""
  const nameValue = name[idx] || ""
  const descValue = desc[idx] || ""

  // Serial Number
  let snValue = sn[idx] || ""
  if (!snValue) {
    const idxWithOne = `${idx}.1`
    snValue = sn[idxWithOne] || ""
  }
  if (!snValue) {
    const indexParts = idx.split('.')
    if (indexParts.length >= 2) {
      const compositeIndex = indexParts[0]
      const onuId = indexParts[1]
      const matchingKeys = Object.keys(sn).filter(k => k.startsWith(`${compositeIndex}.`))
      if (matchingKeys.length > 0) {
        const exactMatch = matchingKeys.find(k => {
          const kParts = k.split('.')
          return kParts.length >= 2 && kParts[1] === onuId
        })
        if (exactMatch) {
          snValue = sn[exactMatch] || ""
        } else {
          snValue = sn[matchingKeys[0]] || ""
        }
      }
    }
  }
  if (!snValue) {
    const indexParts = idx.split('.')
    if (indexParts.length >= 2) {
      const onuId = indexParts[1]
      const matchingKeys = Object.keys(sn).filter(k => {
        const parts = k.split('.')
        return parts.length >= 2 && (parts[parts.length - 1] === onuId || parts[parts.length - 2] === onuId)
      })
      if (matchingKeys.length > 0) {
        snValue = sn[matchingKeys[0]] || ""
      }
    }
  }

  const regValue = reg[idx] || ""

  // Actual Type
  let actualTypeValue = actualType[idx] || ""
  if (!actualTypeValue) {
    const idxWithOne = `${idx}.1`
    actualTypeValue = actualType[idxWithOne] || ""
  }
  if (!actualTypeValue) {
    const indexParts = idx.split('.')
    if (indexParts.length >= 2) {
      const compositeIndex = indexParts[0]
      const onuId = indexParts[1]
      const matchingKeys = Object.keys(actualType).filter(k => k.startsWith(`${compositeIndex}.`))
      if (matchingKeys.length > 0) {
        const exactMatch = matchingKeys.find(k => {
          const kParts = k.split('.')
          return kParts.length >= 2 && kParts[1] === onuId
        })
        if (exactMatch) {
          actualTypeValue = actualType[exactMatch] || ""
        } else {
          actualTypeValue = actualType[matchingKeys[0]] || ""
        }
      }
    }
  }
  if (!actualTypeValue) {
    const indexParts = idx.split('.')
    if (indexParts.length >= 2) {
      const onuId = indexParts[1]
      const matchingKeys = Object.keys(actualType).filter(k => {
        const parts = k.split('.')
        return parts.length >= 2 && (parts[parts.length - 1] === onuId || parts[parts.length - 2] === onuId)
      })
      if (matchingKeys.length > 0) {
        actualTypeValue = actualType[matchingKeys[0]] || ""
      }
    }
  }

  // Handle PPPoE
  let pppoeValue = pppoe[idx] || ""
  if (!pppoeValue) {
    const indexParts = idx.split('.')
    if (indexParts.length >= 2) {
      const onuId = indexParts[1]
      const matchingKeys = Object.keys(pppoe).filter(k => k.endsWith(`.${onuId}`) || k === onuId)
      if (matchingKeys.length > 0) {
        pppoeValue = pppoe[matchingKeys[0]] || ""
      }
    }
  }

  const finalPppoe = parsePppoe(pppoeValue)
  let statusStr = parseStatus(statusValueNew, statusValue)
  if (statusStr === 'Unknown' && nameValue && isValidName(nameValue)) {
    statusStr = 'Online'
  }
  const rxOltStr = parseRxOlt(rxOltNewValue, rxValue)
  if ((statusStr === 'Unknown' || statusStr === 'LOS') && rxOltStr && rxOltStr !== 'N/A') {
    const rxOltNum = parseFloat(rxOltStr.replace(/[^\d.-]/g, ''))
    if (!isNaN(rxOltNum) && rxOltNum > -30) {
      statusStr = 'Online'
    }
  }
  const rxOnuStr = parseRxOnu(rxOnuNewValue, txValue)
  const finalName = parseName(nameValue, idx)
  let finalDesc = descValue || null
  if (!finalDesc) {
    const indexParts = idx.split('.')
    if (indexParts.length >= 2) {
      const onuId = indexParts[1]
      const matchingKeys = Object.keys(desc).filter(k => k.endsWith(`.${onuId}`) || k === onuId)
      if (matchingKeys.length > 0) {
        finalDesc = desc[matchingKeys[0]] || null
      }
    }
  }
  finalDesc = parseDescription(finalDesc || undefined, idx)
  const finalSerial = parseSerialNumber(snValue)
  const finalActualType = parseActualType(actualTypeValue)
  const txOltStr = parseTxOlt(txValue)
  let txOnuNewValue = txOnuNew[idx] || ""
  if (!txOnuNewValue) {
    txOnuNewValue = txOnuNew[`${idx}.1`] || ""
  }
  const txOnuStr = parseTxOnu(txOnuNewValue)
  const registerTime = parseRegisterTime(regValue)

  const getZteValue = (key: string, index: string): string | null => {
    const data = zteAnPonData[key]
    if (!data) return null
    let value = data[index] || null
    if (!value) {
      value = data[`${index}.1`] || null
    }
    if (!value) {
      const indexParts = index.split('.')
      if (indexParts.length >= 2) {
        const onuId = indexParts[1]
        const matchingKeys = Object.keys(data).filter(k => {
          const parts = k.split('.')
          return parts.length >= 2 && (parts[parts.length - 1] === onuId || parts[parts.length - 2] === onuId)
        })
        if (matchingKeys.length > 0) {
          value = data[matchingKeys[0]] || null
        }
      }
    }
    return value || null
  }

  const macAddress = parseMacAddress(getZteValue('macAddress', idx))
  const vendorId = getZteValue('vendorId', idx)?.trim() || null
  const equipmentId = getZteValue('equipmentId', idx)?.trim() || null
  const firmwareVersion = getZteValue('firmwareVersion', idx)?.trim() || null
  const batteryStatus = getZteValue('batteryStatus', idx)?.trim() || null
  const opticalTransceiverType = getZteValue('opticalTransceiverType', idx)?.trim() || null
  const password = getZteValue('password', idx)?.trim() || null
  const loid = getZteValue('loid', idx)?.trim() || null
  const authMode = getZteValue('authMode', idx)?.trim() || null
  const softwareVersion = getZteValue('softwareVersion', idx)?.trim() || null
  const hardwareVersion = getZteValue('hardwareVersion', idx)?.trim() || null
  const configState = getZteValue('configState', idx)?.trim() || null
  const powerLevel = getZteValue('powerLevel', idx)?.trim() || null
  const rxPowerStatus = getZteValue('rxPowerStatus', idx)?.trim() || null
  const txPowerStatus = getZteValue('txPowerStatus', idx)?.trim() || null

  let distance: number | null = null
  const logicalDistanceStr = getZteValue('logicalDistance', idx)
  if (logicalDistanceStr) {
    const distNum = parseFloat(logicalDistanceStr)
    if (!isNaN(distNum) && distNum > 0) {
      distance = distNum / 1000
    }
  }

  let lastRegTime = parseTimestamp(getZteValue('lastRegTime', idx))
  if (!lastRegTime && registerTime) {
    lastRegTime = registerTime
  }
  const lastDeregTime = parseTimestamp(getZteValue('lastDeregTime', idx))
  const dyingGaspTime = parseTimestamp(getZteValue('dyingGaspTime', idx))
  const rxBytes = parseBigInt(getZteValue('rxBytes', idx))
  const txBytes = parseBigInt(getZteValue('txBytes', idx))
  const rxPackets = parseBigInt(getZteValue('rxPackets', idx))
  const txPackets = parseBigInt(getZteValue('txPackets', idx))
  const rxErrors = parseBigInt(getZteValue('rxErrors', idx))
  const txErrors = parseBigInt(getZteValue('txErrors', idx))
  const rxDrops = parseBigInt(getZteValue('rxDrops', idx))
  const txDrops = parseBigInt(getZteValue('txDrops', idx))
  const wifiEnableStr = getZteValue('wifiEnable', idx)
  const wifiEnable = wifiEnableStr ? (wifiEnableStr === '1' || wifiEnableStr.toLowerCase() === 'true' || wifiEnableStr.toLowerCase() === 'enable') : null
  const wifiSsid = getZteValue('wifiSsid', idx)?.trim() || null
  const wifiSecurityMode = getZteValue('wifiSecurityMode', idx)?.trim() || null
  const wifiChannelStr = getZteValue('wifiChannel', idx)
  const wifiChannel = wifiChannelStr ? (parseInt(wifiChannelStr, 10) || null) : null
  const temperature: number | null = null
  const laserBiasCurrent: number | null = null
  const registrationMode: string | null = null
  const lastSeen = new Date()

  // Build OID lengkap untuk setiap field (untuk fast SNMP GET)
  // Format: baseOid.compositeIndex.onuId
  const indexParts = idx.split('.')
  let compositeIndexNum: number | null = null
  if (indexParts.length >= 2) {
    const compositeIndexStr = indexParts[0]
    compositeIndexNum = parseInt(compositeIndexStr, 10) || null
  }

  const statusOid = compositeIndexNum ? `${ONU_OIDS.STATUS_NEW}.${idx}` : null
  const rxOltOid = compositeIndexNum ? `${ONU_OIDS.RX_OLT_NEW}.${idx}` : null
  const rxOnuOid = compositeIndexNum ? `${ONU_OIDS.RX_ONU_NEW}.${idx}` : null
  const nameOid = compositeIndexNum ? `${ONU_OIDS.NAME}.${idx}` : null
  const descOid = compositeIndexNum ? `${ONU_OIDS.DESC}.${idx}` : null

  // Log OID untuk debugging (hanya untuk beberapa ONU pertama)
  if (Math.random() < 0.01) { // Log 1% dari ONU untuk debugging
    console.log(`[ONU-Sync] Built OIDs for ${gponOnu} (idx: ${idx}):`, {
      statusOid,
      rxOltOid,
      rxOnuOid,
      nameOid,
      descOid,
      compositeIndex: compositeIndexNum,
    })
  }

  return {
    oltId,
    name: finalName,
    description: finalDesc,
    pppoe: finalPppoe,
    gponOnu,
    status: statusStr,
    rxOlt: rxOltStr,
    rxOnu: rxOnuStr,
    txOlt: txOltStr,
    txOnu: txOnuStr,
    serialNumber: finalSerial,
    actualType: finalActualType,
    registerTime: lastRegTime,
    distance,
    lastSeen,
    registrationMode,
    softwareVersion,
    hardwareVersion,
    temperature,
    laserBiasCurrent,
    vendorId,
    equipmentId,
    firmwareVersion,
    macAddress,
    batteryStatus,
    opticalTransceiverType,
    lastDeregTime,
    authMode,
    loid,
    password,
    configState,
    powerLevel,
    dyingGaspTime,
    rxPowerStatus,
    txPowerStatus,
    rxBytes,
    txBytes,
    rxPackets,
    txPackets,
    rxErrors,
    txErrors,
    rxDrops,
    txDrops,
    wifiEnable,
    wifiSsid,
    wifiSecurityMode,
    wifiChannel,
    // SNMP OID fields
    statusOid: statusOid || null,
    rxOltOid: rxOltOid || null,
    rxOnuOid: rxOnuOid || null,
    nameOid: nameOid || null,
    descOid: descOid || null,
    compositeIndex: compositeIndexNum,
  }
}

/**
 * Discovery Card dan PON structure dari SNMP menggunakan OID ZTE C320
 * Menggunakan OID dari dokumentasi ZTE C320:
 * - .1.3.6.1.4.1.3902.1015.2.1.1.3.1.4.1.1 - список установленных карт (list of installed cards)
 * - .1.3.6.1.4.1.3902.1015.2.1.1.3.1.5 - Shelf \ Rack
 * - .1.3.6.1.4.1.3902.1015.2.1.1.3.1.6 - Slot (card number)
 * - .1.3.6.1.4.1.3902.1015.2.1.1.3.1.7 - Port numbers
 * - .1.3.6.1.4.1.3902.1012.3.13.1.1.1 - список портов олта: индекс - название (list ports OLT: index - name)
 * @returns Array of { card: number, pon: number, compositeIndex: number }
 */
async function discoverCardAndPonStructure(
  ipAddress: string,
  port: number,
  community: string,
  version: string
): Promise<Array<{ card: number; pon: number; compositeIndex: number }>> {
  console.log(`[C300-GPON-Discovery] Discovering Card and PON structure from OLT (${ipAddress}) using ZTE C320 OIDs...`)

  try {
    // OID dari dokumentasi ZTE C320
    const oidCardList = '1.3.6.1.4.1.3902.1015.2.1.1.3.1.4.1.1' // List of installed cards
    const oidCardShelf = '1.3.6.1.4.1.3902.1015.2.1.1.3.1.5' // Shelf \ Rack
    const oidCardSlot = '1.3.6.1.4.1.3902.1015.2.1.1.3.1.6' // Slot (card number)
    const oidCardPorts = '1.3.6.1.4.1.3902.1015.2.1.1.3.1.7' // Port numbers
    const oidPonPortList = '1.3.6.1.4.1.3902.1012.3.13.1.1.1' // List ports OLT: index - name

    let cardListData: Record<string, string> = {}
    let cardShelfData: Record<string, string> = {}
    let cardSlotData: Record<string, string> = {}
    let cardPortsData: Record<string, string> = {}
    let ponPortListData: Record<string, string> = {}

    // Ambil semua data secara paralel
    try {
      console.log(`[C300-GPON-Discovery] Fetching card and PON data from SNMP using ZTE C320 OIDs...`)
      const [cardList, cardShelf, cardSlot, cardPorts, ponPortList] = await Promise.all([
        snmpGetBulkSimple(ipAddress, port, community, version, oidCardList, 180000).catch(() => ({})),
        snmpGetBulkSimple(ipAddress, port, community, version, oidCardShelf, 180000).catch(() => ({})),
        snmpGetBulkSimple(ipAddress, port, community, version, oidCardSlot, 180000).catch(() => ({})),
        snmpGetBulkSimple(ipAddress, port, community, version, oidCardPorts, 180000).catch(() => ({})),
        snmpGetBulkSimple(ipAddress, port, community, version, oidPonPortList, 180000).catch(() => ({}))
      ])

      cardListData = cardList
      cardShelfData = cardShelf
      cardSlotData = cardSlot
      cardPortsData = cardPorts
      ponPortListData = ponPortList

      console.log(`[C300-GPON-Discovery] Found ${Object.keys(cardListData).length} cards, ${Object.keys(ponPortListData).length} PON ports`)
    } catch (e: any) {
      console.warn(`[C300-GPON-Discovery] Failed to fetch ZTE C320 OIDs: ${e.message || e}, falling back to ifDescr/ifName method`)
      // Fallback ke metode ifDescr/ifName
      return await discoverCardAndPonStructureFromIfDescr(ipAddress, port, community, version)
    }

    // Parse card data
    // Format OID berdasarkan dokumentasi:
    // - .1.3.6.1.4.1.3902.1015.2.1.1.3.1.4.1.1 = list of installed cards (base)
    // - .1.3.6.1.4.1.3902.1015.2.1.1.3.1.5.1.1.1=1 = Shelf \ Rack (rack 1, shelf 1, slot 1)
    // - .1.3.6.1.4.1.3902.1015.2.1.1.3.1.6.1.1.1=4 = Slot (rack 1, shelf 1, slot 1)
    // - .1.3.6.1.4.1.3902.1015.2.1.1.3.1.7.1.1.1=8 = Port numbers (rack 1, shelf 1, slot 1)
    // Format: .1.3.6.1.4.1.3902.1015.2.1.1.3.1.{column}.{rack}.{shelf}.{slot}
    const cardMap = new Map<string, { rack: number; shelf: number; slot: number; ports: number }>()

    // Base OID untuk card table: .1.3.6.1.4.1.3902.1015.2.1.1.3.1
    const cardBaseOid = '1.3.6.1.4.1.3902.1015.2.1.1.3.1'

    // Parse semua card data untuk mendapatkan rack, shelf, slot, dan ports
    // Kita akan menggunakan cardSlotData (column 6) sebagai primary key karena itu adalah slot number
    for (const [oid, value] of Object.entries(cardSlotData)) {
      // OID format: .1.3.6.1.4.1.3902.1015.2.1.1.3.1.6.{rack}.{shelf}.{slot}
      if (oid.startsWith(cardBaseOid + '.6.')) {
        const suffix = oid.substring((cardBaseOid + '.6.').length)
        const parts = suffix.split('.')
        if (parts.length >= 3) {
          const rack = parseInt(parts[0], 10)
          const shelf = parseInt(parts[1], 10)
          const slot = parseInt(parts[2], 10)

          if (!isNaN(rack) && !isNaN(shelf) && !isNaN(slot) && slot > 0) {
            const key = `${rack}-${shelf}-${slot}`

            // Get port numbers untuk card ini (column 7)
            // Format: .1.3.6.1.4.1.3902.1015.2.1.1.3.1.7.{rack}.{shelf}.{slot}
            const portsOid = `${cardBaseOid}.7.${rack}.${shelf}.${slot}`
            const portsValue = cardPortsData[portsOid]
            const portCount = portsValue ? parseInt(portsValue.toString(), 10) : 0

            if (!isNaN(portCount) && portCount > 0) {
              cardMap.set(key, { rack, shelf, slot, ports: portCount })
              console.log(`[C300-GPON-Discovery] Found card: Rack ${rack}, Shelf ${shelf}, Slot ${slot}, Ports: ${portCount}`)
            }
          }
        }
      }
    }

    console.log(`[C300-GPON-Discovery] Parsed ${cardMap.size} cards from card list`)

    // Parse PON port list untuk mendapatkan semua PON yang ada
    // Format OID: .1.3.6.1.4.1.3902.1012.3.13.1.1.1.{compositeIndex}
    const ponPortMap = new Map<number, string>() // compositeIndex -> name

    for (const [oid, name] of Object.entries(ponPortListData)) {
      const oidParts = oid.split('.')
      if (oidParts.length > 0) {
        const compositeIndex = parseInt(oidParts[oidParts.length - 1], 10)
        if (!isNaN(compositeIndex) && compositeIndex > 0) {
          ponPortMap.set(compositeIndex, name.toString())
        }
      }
    }

    console.log(`[C300-GPON-Discovery] Found ${ponPortMap.size} PON ports from port list`)

    // Build card/PON list dari cardMap dan ponPortMap
    const cardPonSet = new Set<string>() // Key: "card-pon"
    const cardPonList: Array<{ card: number; pon: number; compositeIndex: number }> = []

    // Method 1: Dari cardMap (jika ada data card)
    if (cardMap.size > 0) {
      for (const [key, cardInfo] of cardMap.entries()) {
        const { slot, ports } = cardInfo
        // slot adalah card number (1-based)
        const card = slot

        // Generate semua PON untuk card ini (1 sampai ports)
        for (let pon = 1; pon <= ports; pon++) {
          const cardPonKey = `${card}-${pon}`
          if (!cardPonSet.has(cardPonKey)) {
            cardPonSet.add(cardPonKey)
            // Build composite index: frame biasanya 1, slot = card, port = pon
            const frame = 1 // Default frame
            const compositeIndex = buildCompositeIndex(frame, card, pon)
            cardPonList.push({ card, pon, compositeIndex })
          }
        }
      }
    }

    // Method 2: Dari ponPortMap (decode composite index dari PON port list)
    for (const [compositeIndex, portName] of ponPortMap.entries()) {
      const decoded = decodeCompositeIndex(compositeIndex)
      if (decoded && (decoded.type === 1 || decoded.type === 3) && decoded.port) {
        const card = decoded.slot
        const pon = decoded.type === 1 ? decoded.port : decoded.port // Type 3 sudah +1
        const cardPonKey = `${card}-${pon}`

        if (!cardPonSet.has(cardPonKey)) {
          cardPonSet.add(cardPonKey)
          cardPonList.push({ card, pon, compositeIndex })
        }
      }
    }

    // Jika tidak ada data ditemukan, fallback
    if (cardPonList.length === 0) {
      console.warn(`[C300-GPON-Discovery] No Card/PON found from ZTE C320 OIDs, falling back to ifDescr/ifName method`)
      return await discoverCardAndPonStructureFromIfDescr(ipAddress, port, community, version)
    }

    // Sort by card, then by pon
    cardPonList.sort((a, b) => {
      if (a.card !== b.card) return a.card - b.card
      return a.pon - b.pon
    })

    console.log(`[C300-GPON-Discovery] Discovered ${cardPonList.length} Card/PON combinations from ZTE C320 OIDs:`)

    // Group by card untuk display
    const cardGroups = new Map<number, number[]>()
    for (const { card, pon } of cardPonList) {
      if (!cardGroups.has(card)) {
        cardGroups.set(card, [])
      }
      cardGroups.get(card)!.push(pon)
    }

    for (const [card, pons] of Array.from(cardGroups.entries()).sort((a, b) => a[0] - b[0])) {
      console.log(`[C300-GPON-Discovery]   Card ${card}: ${pons.length} PON(s) - PONs: ${pons.sort((a, b) => a - b).join(', ')}`)
    }

    return cardPonList
  } catch (error: any) {
    console.error(`[C300-GPON-Discovery] Error discovering Card/PON structure from ZTE C320 OIDs:`, error)
    // Fallback ke metode ifDescr/ifName jika ada error
    return await discoverCardAndPonStructureFromIfDescr(ipAddress, port, community, version)
  }
}

/**
 * Fallback method: Discovery Card dan PON structure dari ifDescr/ifName
 * @returns Array of { card: number, pon: number, compositeIndex: number }
 */
async function discoverCardAndPonStructureFromIfDescr(
  ipAddress: string,
  port: number,
  community: string,
  version: string
): Promise<Array<{ card: number; pon: number; compositeIndex: number }>> {
  console.log(`[C300-GPON-Discovery] Using ifDescr/ifName method as fallback...`)

  try {
    // OID untuk ifDescr dan ifName (IF-MIB)
    const oidIfDescr = '1.3.6.1.2.1.2.2.1.2' // ifDescr
    const oidIfName = '1.3.6.1.2.1.31.1.1.1.1' // ifName (lebih akurat untuk ZTE)

    let ifDescrData: Record<string, string> = {}
    let ifNameData: Record<string, string> = {}

    // Ambil ifDescr dan ifName secara paralel
    try {
      console.log(`[C300-GPON-Discovery] Fetching ifDescr and ifName from SNMP...`)
      const [descrResults, nameResults] = await Promise.all([
        snmpGetBulkSimple(ipAddress, port, community, version, oidIfDescr, 180000).catch(() => ({})),
        snmpGetBulkSimple(ipAddress, port, community, version, oidIfName, 180000).catch(() => ({}))
      ])

      ifDescrData = descrResults
      ifNameData = nameResults

      console.log(`[C300-GPON-Discovery] Found ${Object.keys(ifDescrData).length} ifDescr entries, ${Object.keys(ifNameData).length} ifName entries`)
    } catch (e: any) {
      console.warn(`[C300-GPON-Discovery] Failed to fetch ifDescr/ifName: ${e.message || e}, falling back to Status New method`)
      // Fallback ke metode lama (Status New)
      return await discoverCardAndPonStructureFromStatusNew(ipAddress, port, community, version)
    }

    // Gabungkan ifDescr dan ifName (ifName lebih prioritas)
    // ifIndex dari OID adalah composite index yang bisa di-decode
    const allInterfaces = new Map<number, { name: string; ifIndex: number }>() // compositeIndex -> { name, ifIndex }

    // Parse OID untuk mendapatkan ifIndex (composite index)
    // Format OID: 1.3.6.1.2.1.2.2.1.2.IFINDEX atau 1.3.6.1.2.1.31.1.1.1.1.IFINDEX
    for (const [oid, descr] of Object.entries(ifDescrData)) {
      const oidParts = oid.split('.')
      if (oidParts.length > 0) {
        const ifIndex = parseInt(oidParts[oidParts.length - 1], 10)
        if (!isNaN(ifIndex) && ifIndex > 0 && descr) {
          // Decode ifIndex sebagai composite index
          const decoded = decodeCompositeIndex(ifIndex)
          if (decoded && (decoded.type === 1 || decoded.type === 3)) {
            allInterfaces.set(ifIndex, { name: descr, ifIndex })
          }
        }
      }
    }
    for (const [oid, name] of Object.entries(ifNameData)) {
      const oidParts = oid.split('.')
      if (oidParts.length > 0) {
        const ifIndex = parseInt(oidParts[oidParts.length - 1], 10)
        if (!isNaN(ifIndex) && ifIndex > 0 && name) {
          // Decode ifIndex sebagai composite index
          const decoded = decodeCompositeIndex(ifIndex)
          if (decoded && (decoded.type === 1 || decoded.type === 3)) {
            allInterfaces.set(ifIndex, { name, ifIndex }) // ifName overwrite ifDescr
          }
        }
      }
    }

    console.log(`[C300-GPON-Discovery] Total interfaces found: ${allInterfaces.size}`)

    // Extract card dan PON dari decoded composite index (ifIndex)
    // Menggunakan decodeCompositeIndex seperti kode Perl
    const cardPonSet = new Set<string>() // Key: "card-pon"
    const cardPonList: Array<{ card: number; pon: number; compositeIndex: number }> = []
    let type1Count = 0
    let type3Count = 0
    let otherTypeCount = 0

    for (const [ifIndex, interfaceInfo] of allInterfaces.entries()) {
      // Decode ifIndex menggunakan fungsi decodeCompositeIndex (sesuai kode Perl)
      const decoded = decodeCompositeIndex(ifIndex)

      if (decoded) {
        if (decoded.type === 1 && decoded.port) {
          // Type 1 (GPON): slot = card, port = PON
          type1Count++
          const card = decoded.slot
          const pon = decoded.port
          const key = `${card}-${pon}`

          if (!cardPonSet.has(key)) {
            cardPonSet.add(key)
            // Gunakan ifIndex sebagai compositeIndex
            cardPonList.push({ card, pon, compositeIndex: ifIndex })
          }
        } else if (decoded.type === 3 && decoded.port !== undefined) {
          // Type 3 (EPON ONU): slot = card, port = olt + 1 = PON
          type3Count++
          const card = decoded.slot
          const pon = decoded.port // sudah +1 dari decodeCompositeIndex
          const key = `${card}-${pon}`

          if (!cardPonSet.has(key)) {
            cardPonSet.add(key)
            // Gunakan ifIndex sebagai compositeIndex
            cardPonList.push({ card, pon, compositeIndex: ifIndex })
          }
        } else {
          otherTypeCount++
        }
      }
    }

    console.log(`[C300-GPON-Discovery] Type 1 (GPON): ${type1Count}, Type 3 (EPON): ${type3Count}, Other: ${otherTypeCount}`)

    // Jika tidak ada GPON port ditemukan dari ifDescr/ifName, fallback ke Status New
    if (cardPonList.length === 0) {
      console.warn(`[C300-GPON-Discovery] No GPON ports found from ifDescr/ifName, falling back to Status New method`)
      return await discoverCardAndPonStructureFromStatusNew(ipAddress, port, community, version)
    }

    // Sort by card, then by pon
    cardPonList.sort((a, b) => {
      if (a.card !== b.card) return a.card - b.card
      return a.pon - b.pon
    })

    console.log(`[C300-GPON-Discovery] Discovered ${cardPonList.length} Card/PON combinations from ifDescr/ifName:`)

    // Group by card untuk display
    const cardGroups = new Map<number, number[]>()
    for (const { card, pon } of cardPonList) {
      if (!cardGroups.has(card)) {
        cardGroups.set(card, [])
      }
      cardGroups.get(card)!.push(pon)
    }

    for (const [card, pons] of Array.from(cardGroups.entries()).sort((a, b) => a[0] - b[0])) {
      console.log(`[C300-GPON-Discovery]   Card ${card}: ${pons.length} PON(s) - PONs: ${pons.sort((a, b) => a - b).join(', ')}`)
    }

    return cardPonList
  } catch (error: any) {
    console.error(`[C300-GPON-Discovery] Error discovering Card/PON structure from ifDescr/ifName:`, error)
    // Fallback ke metode Status New jika ada error
    return await discoverCardAndPonStructureFromStatusNew(ipAddress, port, community, version)
  }
}

/**
 * Fallback method: Discovery Card dan PON structure dari Status New
 * @returns Array of { card: number, pon: number, compositeIndex: number }
 */
async function discoverCardAndPonStructureFromStatusNew(
  ipAddress: string,
  port: number,
  community: string,
  version: string
): Promise<Array<{ card: number; pon: number; compositeIndex: number }>> {
  console.log(`[C300-GPON-Discovery] Using Status New method as fallback...`)

  try {
    // Gunakan Status New karena biasanya paling lengkap dan konsisten
    const oidStatusNew = ONU_OIDS.STATUS_NEW

    let statusData: Record<string, string> = {}

    try {
      // Gunakan timeout 5 menit
      statusData = await snmpGetBulkSimple(ipAddress, port, community, version, oidStatusNew, 300000)
    } catch (e: any) {
      console.warn(`[C300-GPON-Discovery] Failed to fetch Status New: ${e.message || e}`)
    }

    if (Object.keys(statusData).length === 0) {
      console.warn(`[C300-GPON-Discovery] No Status New data found, cannot discover Card/PON structure`)
      return []
    }

    console.log(`[C300-GPON-Discovery] Found ${Object.keys(statusData).length} Status New entries`)

    // Extract card dan PON dari composite index
    const cardPonSet = new Set<string>() // Key: "card-pon"
    const cardPonList: Array<{ card: number; pon: number; compositeIndex: number }> = []

    for (const idx of Object.keys(statusData)) {
      const indexParts = idx.split('.')
      if (indexParts.length >= 1) {
        const compositeIndex = parseInt(indexParts[0], 10)
        if (!isNaN(compositeIndex)) {
          const parsed = parseCompositeIndex(compositeIndex)
          if (parsed && parsed.type === 1 && parsed.slot > 0 && parsed.port > 0) {
            const card = parsed.slot
            const pon = parsed.port
            const key = `${card}-${pon}`

            if (!cardPonSet.has(key)) {
              cardPonSet.add(key)
              cardPonList.push({ card, pon, compositeIndex })
            }
          }
        }
      }
    }

    // Sort by card, then by pon
    cardPonList.sort((a, b) => {
      if (a.card !== b.card) return a.card - b.card
      return a.pon - b.pon
    })

    console.log(`[C300-GPON-Discovery] Discovered ${cardPonList.length} Card/PON combinations from Status New:`)

    // Group by card untuk display
    const cardGroups = new Map<number, number[]>()
    for (const { card, pon } of cardPonList) {
      if (!cardGroups.has(card)) {
        cardGroups.set(card, [])
      }
      cardGroups.get(card)!.push(pon)
    }

    for (const [card, pons] of Array.from(cardGroups.entries()).sort((a, b) => a[0] - b[0])) {
      console.log(`[C300-GPON-Discovery]   Card ${card}: ${pons.length} PON(s) - PONs: ${pons.sort((a, b) => a - b).join(', ')}`)
    }

    return cardPonList
  } catch (error: any) {
    console.error(`[C300-GPON-Discovery] Error discovering Card/PON structure from Status New:`, error)
    return []
  }
}


export async function getC300GponOnuDataViaSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltId: string,
  maxResults?: number,
  expectedCount?: number // Expected ONU count dari countOnuFromSNMP
): Promise<Array<OnuSyncData>> {
  console.log(`[C300-GPON-SNMP] Fetching ONU data from OLT (${ipAddress}) via SNMP...`)
  console.log(`[C300-GPON-SNMP] Using GPON port-based approach (per PON)`)

  // Gunakan OID constants dari ONU_OIDS
  const oidStatus = ONU_OIDS.STATUS
  const oidStatusNew = ONU_OIDS.STATUS_NEW
  const oidName = ONU_OIDS.NAME
  const oidRx = ONU_OIDS.RX_OLT_OLD
  const oidTx = ONU_OIDS.TX_OLT
  const oidSN = ONU_OIDS.SERIAL
  const oidSNAlt1 = ONU_OIDS.SERIAL_ALT1
  const oidReg = ONU_OIDS.REGISTER_TIME
  const oidDesc = ONU_OIDS.DESC
  const oidPppoe = ONU_OIDS.PPPOE
  const oidRxOltNew = ONU_OIDS.RX_OLT_NEW
  const oidRxOltAlt1 = ONU_OIDS.RX_OLT_ALT1
  const oidRxOltAlt2 = ONU_OIDS.RX_OLT_OLD
  const oidRxOnuNew = ONU_OIDS.RX_ONU_NEW
  const oidTxOnuNew = ONU_OIDS.TX_ONU_NEW
  const oidActualType = ONU_OIDS.ACTUAL_TYPE
  const oidActualTypeAlt1 = ONU_OIDS.ACTUAL_TYPE_ALT1
  const oidActualTypeAlt2 = ONU_OIDS.ACTUAL_TYPE_ALT2

  // ZTE-AN-PON-MIB OIDs
  const oidZteMacAddress = ONU_OIDS.ZTE_MAC_ADDRESS
  const oidZteVendorId = ONU_OIDS.ZTE_VENDOR_ID
  const oidZteEquipmentId = ONU_OIDS.ZTE_EQUIPMENT_ID
  const oidZteFirmwareVersion = ONU_OIDS.ZTE_FIRMWARE_VERSION
  const oidZteBatteryStatus = ONU_OIDS.ZTE_BATTERY_STATUS
  const oidZteOpticalTransceiverType = ONU_OIDS.ZTE_OPTICAL_TRANSCEIVER_TYPE
  const oidZtePassword = ONU_OIDS.ZTE_PASSWORD
  const oidZteLoid = ONU_OIDS.ZTE_LOID
  const oidZteAuthMode = ONU_OIDS.ZTE_AUTH_MODE
  const oidZteLastRegTime = ONU_OIDS.ZTE_LAST_REG_TIME
  const oidZteLastDeregTime = ONU_OIDS.ZTE_LAST_DEREG_TIME
  const oidZteSoftwareVersion = ONU_OIDS.ZTE_SOFTWARE_VERSION
  const oidZteHardwareVersion = ONU_OIDS.ZTE_HARDWARE_VERSION
  const oidZteLogicalDistance = ONU_OIDS.ZTE_LOGICAL_DISTANCE
  const oidZteConfigState = ONU_OIDS.ZTE_CONFIG_STATE
  const oidZtePowerLevel = ONU_OIDS.ZTE_POWER_LEVEL
  const oidZteDyingGaspTime = ONU_OIDS.ZTE_DYING_GASP_TIME
  const oidZteRxPowerStatus = ONU_OIDS.ZTE_RX_POWER_STATUS
  const oidZteTxPowerStatus = ONU_OIDS.ZTE_TX_POWER_STATUS
  const oidZteRxPower = ONU_OIDS.ZTE_RX_POWER
  const oidZteTxPower = ONU_OIDS.ZTE_TX_POWER
  const oidZteRxBytes = ONU_OIDS.ZTE_RX_BYTES
  const oidZteTxBytes = ONU_OIDS.ZTE_TX_BYTES
  const oidZteRxPackets = ONU_OIDS.ZTE_RX_PACKETS
  const oidZteTxPackets = ONU_OIDS.ZTE_TX_PACKETS
  const oidZteRxErrors = ONU_OIDS.ZTE_RX_ERRORS
  const oidZteTxErrors = ONU_OIDS.ZTE_TX_ERRORS
  const oidZteRxDrops = ONU_OIDS.ZTE_RX_DROPS
  const oidZteTxDrops = ONU_OIDS.ZTE_TX_DROPS
  const oidZteWifiEnable = ONU_OIDS.ZTE_WIFI_ENABLE
  const oidZteWifiSsid = ONU_OIDS.ZTE_WIFI_SSID
  const oidZteWifiSecurityMode = ONU_OIDS.ZTE_WIFI_SECURITY_MODE
  const oidZteWifiChannel = ONU_OIDS.ZTE_WIFI_CHANNEL

  try {
    // OPTIMASI: Gabungkan discovery dengan fetch Status New utama untuk menghindari redundant fetch
    // STEP 1: Fetch Status New (untuk discovery dan data utama sekaligus)
    console.log(`[C300-GPON-SNMP] ========================================`)
    console.log(`[C300-GPON-SNMP] STEP 1: FETCHING STATUS NEW (for discovery + main data)`)
    console.log(`[C300-GPON-SNMP] ========================================`)

    // Timeout adaptif berdasarkan expected count (didefinisikan lebih awal untuk digunakan di semua fetch)
    const adaptiveTimeout = expectedCount && expectedCount > 500 ? 300000 : 180000 // 5 menit untuk dataset besar, 3 menit untuk kecil

    // Fetch Status New sekali untuk discovery dan data utama
    let statusNew: Record<string, string> = {}
    let cardPonStructure: Array<{ card: number; pon: number; compositeIndex: number }> = []

    // Fetch Status New dengan GET NEXT untuk menangani data yang terputus-putus
    // OPTIMASI: Langsung gunakan GET NEXT jika data terputus-putus (lebih reliable untuk data besar)
    console.log(`[C300-GPON-SNMP] Fetching Status New using GETBULK first, then GET NEXT if needed...`)
    const timeout = adaptiveTimeout

    try {
      // Coba GETBULK dulu
      const bulkData = await snmpGetBulkSimple(ipAddress, port, community, version, oidStatusNew, timeout, undefined, expectedCount)
      const bulkCount = Object.keys(bulkData).length
      statusNew = { ...bulkData }

      console.log(`[C300-GPON-SNMP] Status New (GETBULK): Got ${bulkCount} entries${expectedCount ? ` (expected: ${expectedCount})` : ''}`)

      // Jika tidak lengkap atau expectedCount tidak terpenuhi, gunakan GET NEXT
      if (expectedCount && bulkCount < expectedCount) {
        const missing = expectedCount - bulkCount
        const missingPercentage = (missing / expectedCount) * 100
        console.log(`[C300-GPON-SNMP] Status New: Missing ${missing} entries (${missingPercentage.toFixed(1)}%), using GET NEXT to handle fragmented data...`)

        try {
          const { snmpWalkWithGetNext } = await import('@/lib/utils/snmp-helpers')
          const getNextResults = await snmpWalkWithGetNext(
            ipAddress,
            port,
            community,
            version,
            oidStatusNew,
            timeout,
            expectedCount
          )

          // Convert getNext results ke format Record<string, string>
          const getNextData: Record<string, string> = {}
          for (const result of getNextResults) {
            if (result.value !== null && result.value !== undefined) {
              const oidStr = result.oid.toString()
              const oidParts = oidStr.split('.')
              const baseOidParts = oidStatusNew.split('.').filter(p => p.length > 0)

              if (oidParts.length > baseOidParts.length) {
                const index = oidParts.slice(baseOidParts.length).join('.')
                let valueStr: string
                if (Buffer.isBuffer(result.value)) {
                  valueStr = Array.from(result.value as Uint8Array)
                    .map((b: number) => b.toString(16).toUpperCase().padStart(2, '0'))
                    .join(' ')
                } else {
                  valueStr = result.value.toString()
                }
                getNextData[index] = valueStr
              }
            }
          }

          const getNextCount = Object.keys(getNextData).length
          console.log(`[C300-GPON-SNMP] GET NEXT returned ${getNextCount} entries (vs ${bulkCount} from GETBULK)`)

          // Merge: gunakan getNextData untuk semua (lebih lengkap)
          if (getNextCount >= bulkCount) {
            const improvement = getNextCount - bulkCount
            if (improvement > 0) {
              console.log(`[C300-GPON-SNMP] GET NEXT found ${improvement} additional entries, using GET NEXT results`)
            }
            statusNew = getNextData // Gunakan GET NEXT results (lebih lengkap)
            console.log(`[C300-GPON-SNMP] Status New: Using GET NEXT results (${Object.keys(statusNew).length} entries)`)
          } else {
            // Merge: tambahkan yang missing dari GET NEXT
            for (const [index, value] of Object.entries(getNextData)) {
              if (!statusNew[index]) {
                statusNew[index] = value
              }
            }
            console.log(`[C300-GPON-SNMP] Status New: Merged GET NEXT with GETBULK (${Object.keys(statusNew).length} entries)`)
          }
        } catch (getNextError: any) {
          console.warn(`[C300-GPON-SNMP] GET NEXT fallback failed: ${getNextError.message || getNextError}, using GETBULK results`)
        }
      } else if (!expectedCount && bulkCount < 100) {
        // Jika tidak ada expectedCount tapi hasil terlalu sedikit, coba GET NEXT
        console.log(`[C300-GPON-SNMP] Status New: Only ${bulkCount} entries (seems incomplete), trying GET NEXT...`)
        try {
          const { snmpWalkWithGetNext } = await import('@/lib/utils/snmp-helpers')
          const getNextResults = await snmpWalkWithGetNext(
            ipAddress,
            port,
            community,
            version,
            oidStatusNew,
            timeout
          )

          // Convert getNext results
          const getNextData: Record<string, string> = {}
          for (const result of getNextResults) {
            if (result.value !== null && result.value !== undefined) {
              const oidStr = result.oid.toString()
              const oidParts = oidStr.split('.')
              const baseOidParts = oidStatusNew.split('.').filter(p => p.length > 0)

              if (oidParts.length > baseOidParts.length) {
                const index = oidParts.slice(baseOidParts.length).join('.')
                let valueStr: string
                if (Buffer.isBuffer(result.value)) {
                  valueStr = Array.from(result.value as Uint8Array)
                    .map((b: number) => b.toString(16).toUpperCase().padStart(2, '0'))
                    .join(' ')
                } else {
                  valueStr = result.value.toString()
                }
                getNextData[index] = valueStr
              }
            }
          }

          if (Object.keys(getNextData).length > bulkCount) {
            console.log(`[C300-GPON-SNMP] GET NEXT found more entries (${Object.keys(getNextData).length} vs ${bulkCount}), using GET NEXT results`)
            statusNew = getNextData
          }
        } catch (getNextError: any) {
          console.warn(`[C300-GPON-SNMP] GET NEXT fallback failed: ${getNextError.message || getNextError}`)
        }
      }
    } catch (e: any) {
      console.warn(`[C300-GPON-SNMP] SNMP GETBULK failed for status (new): ${e.message || e}, trying GET NEXT directly...`)
      try {
        const { snmpWalkWithGetNext } = await import('@/lib/utils/snmp-helpers')
        const getNextResults = await snmpWalkWithGetNext(
          ipAddress,
          port,
          community,
          version,
          oidStatusNew,
          timeout,
          expectedCount
        )

        // Convert getNext results
        statusNew = {}
        for (const result of getNextResults) {
          if (result.value !== null && result.value !== undefined) {
            const oidStr = result.oid.toString()
            const oidParts = oidStr.split('.')
            const baseOidParts = oidStatusNew.split('.').filter(p => p.length > 0)

            if (oidParts.length > baseOidParts.length) {
              const index = oidParts.slice(baseOidParts.length).join('.')
              let valueStr: string
              if (Buffer.isBuffer(result.value)) {
                valueStr = Array.from(result.value)
                  .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                  .join(' ')
              } else {
                valueStr = result.value.toString()
              }
              statusNew[index] = valueStr
            }
          }
        }
        console.log(`[C300-GPON-SNMP] Status New (GET NEXT): Got ${Object.keys(statusNew).length} entries`)
      } catch (getNextError: any) {
        console.error(`[C300-GPON-SNMP] GET NEXT also failed: ${getNextError.message || getNextError}`)
        statusNew = {}
      }
    }

    console.log(`[C300-GPON-SNMP] Status New: Final count = ${Object.keys(statusNew).length} entries${expectedCount ? ` (expected: ${expectedCount})` : ''}`)

    // Discover Card/PON structure menggunakan ifDescr/ifName (lebih lengkap dan reliable)
    // Fungsi ini akan menggunakan SNMP ifDescr/ifName untuk mendapatkan semua interface GPON
    // dan parse untuk mendapatkan semua card/PON yang ada, bukan hanya yang punya ONU
    console.log(`[C300-GPON-SNMP] Discovering Card/PON structure using ifDescr/ifName...`)
    cardPonStructure = await discoverCardAndPonStructure(ipAddress, port, community, version)

    // OPTIMASI: Jika Status New tidak lengkap dan ada cardPonStructure, ambil data per Card/PON
    // Menggunakan GET NEXT untuk menangani data yang terputus-putus
    if (expectedCount && Object.keys(statusNew).length < expectedCount && cardPonStructure.length > 0) {
      const missing = expectedCount - Object.keys(statusNew).length
      const missingPercentage = (missing / expectedCount) * 100
      console.log(`[C300-GPON-SNMP] Status New incomplete (missing ${missing} = ${missingPercentage.toFixed(1)}%), fetching per Card/PON using GET NEXT to ensure all PONs are checked...`)

      // Ambil data per Card/PON secara paralel dengan controlled concurrency
      const perCardPonData: Record<string, string> = {}
      const totalPons = cardPonStructure.length
      const concurrencyLimit = 5 // 5 PON sekaligus

      // Helper function untuk fetch per Card/PON
      const fetchPonData = async ({ card, pon, compositeIndex }: { card: number; pon: number; compositeIndex: number }): Promise<Record<string, string>> => {
        const ponData: Record<string, string> = {}
        try {
          // Build OID untuk Card/PON ini: baseOid.compositeIndex
          // Status New OID: 1.3.6.1.4.1.3902.1012.3.28.2.1.4.{compositeIndex}.{onuId}
          const ponOid = `${oidStatusNew}.${compositeIndex}`

          // Fetch dengan GET NEXT untuk Card/PON ini
          const { snmpWalkWithGetNext } = await import('@/lib/utils/snmp-helpers')
          const ponResults = await snmpWalkWithGetNext(
            ipAddress,
            port,
            community,
            version,
            ponOid,
            Math.min(adaptiveTimeout, 60000), // Timeout lebih pendek per PON (1 menit)
            undefined // Tidak ada expected count per PON
          )

          // Convert results
          for (const result of ponResults) {
            if (result.value !== null && result.value !== undefined) {
              const oidStr = result.oid.toString()
              const oidParts = oidStr.split('.')
              const baseOidParts = oidStatusNew.split('.').filter(p => p.length > 0)

              if (oidParts.length > baseOidParts.length) {
                const index = oidParts.slice(baseOidParts.length).join('.')
                let valueStr: string
                if (Buffer.isBuffer(result.value)) {
                  valueStr = Array.from(result.value as Uint8Array)
                    .map((b: number) => b.toString(16).toUpperCase().padStart(2, '0'))
                    .join(' ')
                } else {
                  valueStr = result.value.toString()
                }
                ponData[index] = valueStr
              }
            }
          }
        } catch (ponError: any) {
          // Skip error per PON, return empty
          console.warn(`[C300-GPON-SNMP] Failed to fetch Card ${card}/PON ${pon}: ${ponError.message || ponError}`)
        }
        return ponData
      }

      // Process per Card/PON secara paralel dengan controlled concurrency
      for (let i = 0; i < cardPonStructure.length; i += concurrencyLimit) {
        const batch = cardPonStructure.slice(i, i + concurrencyLimit)
        const batchNum = Math.floor(i / concurrencyLimit) + 1
        const totalBatches = Math.ceil(cardPonStructure.length / concurrencyLimit)

        console.log(`[C300-GPON-SNMP] Fetching PON batch ${batchNum}/${totalBatches} (${batch.length} PONs)...`)

        // Fetch batch secara paralel
        const batchResults = await Promise.all(
          batch.map(ponInfo => fetchPonData(ponInfo))
        )

        // Merge batch results
        for (const ponData of batchResults) {
          for (const [index, value] of Object.entries(ponData)) {
            // Hanya tambahkan jika belum ada (untuk menghindari duplikasi)
            if (!statusNew[index] && !perCardPonData[index]) {
              perCardPonData[index] = value
            }
          }
        }

        // Progress log
        const currentTotal = Object.keys(statusNew).length + Object.keys(perCardPonData).length
        console.log(`[C300-GPON-SNMP] Progress: ${i + batch.length}/${totalPons} PONs checked, found ${Object.keys(perCardPonData).length} additional ONUs (total so far: ${currentTotal})`)
      }

      // Merge per Card/PON data dengan statusNew
      if (Object.keys(perCardPonData).length > 0) {
        const beforeCount = Object.keys(statusNew).length
        for (const [index, value] of Object.entries(perCardPonData)) {
          if (!statusNew[index]) {
            statusNew[index] = value
          }
        }
        const afterCount = Object.keys(statusNew).length
        const improvement = afterCount - beforeCount
        console.log(`[C300-GPON-SNMP] Per Card/PON fetch: Added ${improvement} additional ONUs (${beforeCount} -> ${afterCount})`)
      } else {
        console.log(`[C300-GPON-SNMP] Per Card/PON fetch: No additional ONUs found`)
      }

      console.log(`[C300-GPON-SNMP] Status New after per Card/PON fetch: ${Object.keys(statusNew).length} entries${expectedCount ? ` (expected: ${expectedCount})` : ''}`)
    }

    if (cardPonStructure.length === 0) {
      // Jika tidak ada card/PON ditemukan dari ifDescr/ifName, coba dari Status New sebagai fallback
      console.warn(`[C300-GPON-SNMP] No Card/PON found from ifDescr/ifName, trying Status New as fallback...`)
      if (Object.keys(statusNew).length > 0) {
        console.log(`[C300-GPON-SNMP] Extracting Card/PON structure from Status New data...`)
        const cardPonSet = new Set<string>()
        const cardPonList: Array<{ card: number; pon: number; compositeIndex: number }> = []

        for (const idx of Object.keys(statusNew)) {
          const indexParts = idx.split('.')
          if (indexParts.length >= 1) {
            const compositeIndex = parseInt(indexParts[0], 10)
            if (!isNaN(compositeIndex)) {
              const parsed = parseCompositeIndex(compositeIndex)
              if (parsed && parsed.type === 1 && parsed.slot > 0 && parsed.port > 0) {
                const card = parsed.slot
                const pon = parsed.port
                const key = `${card}-${pon}`

                if (!cardPonSet.has(key)) {
                  cardPonSet.add(key)
                  cardPonList.push({ card, pon, compositeIndex })
                }
              }
            }
          }
        }

        cardPonList.sort((a, b) => {
          if (a.card !== b.card) return a.card - b.card
          return a.pon - b.pon
        })

        cardPonStructure = cardPonList

        if (cardPonStructure.length > 0) {
          const cardGroups = new Map<number, number[]>()
          for (const { card, pon } of cardPonStructure) {
            if (!cardGroups.has(card)) {
              cardGroups.set(card, [])
            }
            cardGroups.get(card)!.push(pon)
          }

          for (const [card, pons] of Array.from(cardGroups.entries()).sort((a, b) => a[0] - b[0])) {
            console.log(`[C300-GPON-SNMP]   Card ${card}: ${pons.length} PON(s) - PONs: ${pons.sort((a, b) => a - b).join(', ')}`)
          }
        }
      }
    }

    // STEP 2: Fetch semua data ONU lainnya secara global
    console.log(`[C300-GPON-SNMP] ========================================`)
    console.log(`[C300-GPON-SNMP] STEP 2: FETCHING ALL ONU DATA (GLOBAL)`)
    console.log(`[C300-GPON-SNMP] ========================================`)
    console.log(`[C300-GPON-SNMP] Fetching OIDs using GETBULK${maxResults ? ` (max ${maxResults} results)` : ''}...`)

    // Fetch TX ONU
    // TIDAK gunakan maxResults untuk memastikan semua data terambil
    // Gunakan timeout adaptif berdasarkan expected count
    let txOnuNew: Record<string, string> = {}
    try {
      txOnuNew = await snmpGetBulkSimple(ipAddress, port, community, version, oidTxOnuNew, adaptiveTimeout)
      console.log(`[C300-GPON-SNMP] TX ONU: ${Object.keys(txOnuNew).length} entries`)
    } catch (e: any) {
      console.warn(`[C300-GPON-SNMP] SNMP GETBULK failed for TX ONU: ${e.message || e}`)
      txOnuNew = {}
    }

    // Fetch ZTE-AN-PON-MIB data (opsional, akan di-fetch jika tersedia)
    // Optimasi: Early exit jika beberapa OID pertama tidak ada data (0 entries)
    const fetchZteAnPonData = async () => {
      const results: Record<string, Record<string, string>> = {}
      const oids = {
        macAddress: oidZteMacAddress,
        vendorId: oidZteVendorId,
        equipmentId: oidZteEquipmentId,
        firmwareVersion: oidZteFirmwareVersion,
        batteryStatus: oidZteBatteryStatus,
        opticalTransceiverType: oidZteOpticalTransceiverType,
        password: oidZtePassword,
        loid: oidZteLoid,
        authMode: oidZteAuthMode,
        lastRegTime: oidZteLastRegTime,
        lastDeregTime: oidZteLastDeregTime,
        softwareVersion: oidZteSoftwareVersion,
        hardwareVersion: oidZteHardwareVersion,
        logicalDistance: oidZteLogicalDistance,
        configState: oidZteConfigState,
        powerLevel: oidZtePowerLevel,
        dyingGaspTime: oidZteDyingGaspTime,
        rxPowerStatus: oidZteRxPowerStatus,
        txPowerStatus: oidZteTxPowerStatus,
        rxPower: oidZteRxPower,
        txPower: oidZteTxPower,
        rxBytes: oidZteRxBytes,
        txBytes: oidZteTxBytes,
        rxPackets: oidZteRxPackets,
        txPackets: oidZteTxPackets,
        rxErrors: oidZteRxErrors,
        txErrors: oidZteTxErrors,
        rxDrops: oidZteRxDrops,
        txDrops: oidZteTxDrops,
        wifiEnable: oidZteWifiEnable,
        wifiSsid: oidZteWifiSsid,
        wifiSecurityMode: oidZteWifiSecurityMode,
        wifiChannel: oidZteWifiChannel,
      }

      // Optimasi: Test beberapa OID pertama untuk early exit
      // Jika 3 OID pertama semua 0 entries, skip semua OID lainnya
      const testOids = Object.entries(oids).slice(0, 3)
      const testResults = await Promise.allSettled(
        testOids.map(async ([key, oid]) => {
          try {
            const testTimeout = 20000 // 20 detik untuk test (lebih cepat dari 30 detik)
            const data = await snmpGetBulkSimple(ipAddress, port, community, version, oid, testTimeout)
            return { key, count: Object.keys(data).length }
          } catch (e: any) {
            return { key, count: 0 }
          }
        })
      )

      // Check jika semua test OIDs return 0 entries
      const allZero = testResults.every(result => {
        if (result.status === 'fulfilled') {
          return result.value.count === 0
        }
        return true
      })

      if (allZero) {
        console.log(`[C300-GPON-SNMP] ZTE-AN-PON: All test OIDs returned 0 entries, skipping all ZTE-AN-PON fetches to save time`)
        // Return empty results untuk semua OIDs
        Object.keys(oids).forEach(key => {
          results[key] = {}
        })
        return results
      }

      // Jika ada data, fetch semua OID secara parallel dengan error handling
      // Gunakan timeout lebih pendek untuk optional data (20 detik, lebih cepat)
      const optionalTimeout = 20000 // 20 detik untuk optional data (lebih cepat dari 30 detik)
      const fetchPromises = Object.entries(oids).map(async ([key, oid]) => {
        try {
          const data = await snmpGetBulkSimple(ipAddress, port, community, version, oid, optionalTimeout)
          console.log(`[C300-GPON-SNMP] ZTE-AN-PON ${key}: ${Object.keys(data).length} entries`)
          return { key, data }
        } catch (e: any) {
          // Skip optional OID jika timeout atau error, tidak throw error
          if (e.message && e.message.includes('timeout')) {
            console.warn(`[C300-GPON-SNMP] SNMP GETBULK timeout for ${key} (optional), skipping...`)
          } else {
            console.warn(`[C300-GPON-SNMP] SNMP GETBULK failed for ${key}: ${e.message || e}`)
          }
          return { key, data: {} as Record<string, string> }
        }
      })

      const fetchResults = await Promise.all(fetchPromises)
      fetchResults.forEach(({ key, data }) => {
        results[key] = data
      })

      return results
    }

    // Optimized SNMP fetching dengan batching untuk mengurangi load
    console.log(`[C300-GPON-SNMP] Fetching ONU data in optimized batches...`)

    // Helper function untuk fetch dengan fallback dan retry mechanism
    // Memastikan semua data terambil dengan lengkap, tidak ada yang terputus
    const fetchWithFallbackAndRetry = async (
      mainOid: string,
      altOid: string | null,
      name: string,
      expectedIndexes?: Set<string> // Indexes yang diharapkan ada (untuk validasi)
    ): Promise<Record<string, string>> => {
      const maxRetries = 2 // Dikurangi dari 3 menjadi 2 untuk lebih cepat
      let result: Record<string, string> = {}
      // Timeout adaptif berdasarkan expected count
      const timeout = expectedCount && expectedCount > 500 ? 300000 : 180000

      // Try main OID dengan retry
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[C300-GPON-SNMP] Fetching ${name} (main OID, attempt ${attempt}/${maxRetries})...`)
          const data = await snmpGetBulkSimple(ipAddress, port, community, version, mainOid, timeout)

          if (Object.keys(data).length > 0) {
            result = { ...result, ...data }
            console.log(`[C300-GPON-SNMP] ${name} (main): ${Object.keys(data).length} entries (total: ${Object.keys(result).length})`)

            // Validasi jika expectedIndexes diberikan
            if (expectedIndexes && expectedIndexes.size > 0) {
              const missingIndexes = Array.from(expectedIndexes).filter(idx => !result[idx])
              const missingPercentage = (missingIndexes.length / expectedIndexes.size) * 100

              // Skip retry untuk Actual Type jika missing < 1%
              if (name === 'Actual Type' && missingPercentage < 1) {
                console.log(`[C300-GPON-SNMP] ${name}: Only ${missingIndexes.length} indexes missing (${missingPercentage.toFixed(2)}%), accepting result`)
                return result
              }

              // Early exit: jika missing < 2%, langsung accept (lebih agresif)
              if (missingPercentage < 2) {
                console.log(`[C300-GPON-SNMP] ${name}: Only ${missingIndexes.length} indexes missing (${missingPercentage.toFixed(2)}%), accepting result`)
                return result
              }

              if (missingIndexes.length > 0 && missingIndexes.length < expectedIndexes.size * 0.2) {
                // Jika kurang dari 20% yang missing, coba retry untuk yang missing
                console.log(`[C300-GPON-SNMP] ${name}: ${missingIndexes.length} indexes missing (${missingPercentage.toFixed(2)}%), will retry...`)
                if (attempt < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 500)) // Delay 0.5 detik sebelum retry (lebih cepat)
                  continue
                }
              } else if (missingIndexes.length === 0) {
                // Semua data lengkap
                console.log(`[C300-GPON-SNMP] ${name}: All expected indexes found!`)
                return result
              }
            } else {
              // Jika tidak ada expectedIndexes, return hasil pertama yang berhasil
              return result
            }
          }
        } catch (e: any) {
          console.warn(`[C300-GPON-SNMP] SNMP GETBULK failed for ${name} (main, attempt ${attempt}): ${e.message || e}`)
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500)) // Delay 0.5 detik sebelum retry (lebih cepat)
          }
        }
      }

      // Try alt OID jika main OID tidak lengkap atau gagal
      if (altOid) {
        const maxAltRetries = 2 // Dikurangi dari 3 menjadi 2
        for (let attempt = 1; attempt <= maxAltRetries; attempt++) {
          try {
            console.log(`[C300-GPON-SNMP] Fetching ${name} (alt OID, attempt ${attempt}/${maxAltRetries})...`)
            const data = await snmpGetBulkSimple(ipAddress, port, community, version, altOid, timeout)

            if (Object.keys(data).length > 0) {
              // Merge dengan result yang sudah ada
              for (const [key, value] of Object.entries(data)) {
                if (!result[key]) {
                  result[key] = value
                }
              }
              console.log(`[C300-GPON-SNMP] ${name} (alt): ${Object.keys(data).length} entries (total: ${Object.keys(result).length})`)

              // Early exit: jika sudah cukup lengkap, tidak perlu retry lagi
              if (expectedIndexes && expectedIndexes.size > 0) {
                const missingIndexes = Array.from(expectedIndexes).filter(idx => !result[idx])
                const missingPercentage = (missingIndexes.length / expectedIndexes.size) * 100
                if (missingPercentage < 2) {
                  console.log(`[C300-GPON-SNMP] ${name}: Only ${missingIndexes.length} indexes missing (${missingPercentage.toFixed(2)}%), accepting result`)
                  return result
                }
              } else {
                // Jika tidak ada expectedIndexes, return setelah dapat data
                return result
              }
            }
          } catch (e: any) {
            console.warn(`[C300-GPON-SNMP] SNMP GETBULK failed for ${name} (alt, attempt ${attempt}): ${e.message || e}`)
            if (attempt < maxAltRetries) {
              await new Promise(resolve => setTimeout(resolve, 500)) // Delay 0.5 detik sebelum retry (lebih cepat)
            }
          }
        }
      }

      return result
    }

    // Helper function untuk fetch dengan fallback (backward compatibility)
    const fetchWithFallback = async (
      mainOid: string,
      altOid: string | null,
      name: string
    ): Promise<Record<string, string>> => {
      return fetchWithFallbackAndRetry(mainOid, altOid, name)
    }

    // OPTIMASI: Status New sudah di-fetch di STEP 1, tidak perlu fetch lagi
    // Batch 1: Validasi Status New yang sudah di-fetch
    console.log(`[C300-GPON-SNMP] Using Status New data from STEP 1 (${Object.keys(statusNew).length} entries)`)
    if (expectedCount) {
      console.log(`[C300-GPON-SNMP] Expected ONU count from previous step: ${expectedCount}`)
    }

    if (Object.keys(statusNew).length === 0) {
      console.warn(`[C300-GPON-SNMP] WARNING: No Status New data found`)
    } else {
      const finalCount = Object.keys(statusNew).length
      if (expectedCount && finalCount < expectedCount) {
        console.warn(`[C300-GPON-SNMP] WARNING: Status New incomplete! Got ${finalCount} entries but expected ${expectedCount} entries`)
        console.warn(`[C300-GPON-SNMP] Will continue with available data, but some ONUs may be missing`)
      }
    }

    // Set expected indexes: gunakan expectedCount jika Status New tidak lengkap
    // Tapi untuk validasi data lainnya, gunakan indexes yang benar-benar ada di Status New
    const statusNewIndexes = new Set(Object.keys(statusNew))
    console.log(`[C300-GPON-SNMP] Status New indexes: ${statusNewIndexes.size} entries`)

    // Jika ada expectedCount dan Status New tidak lengkap, kita tetap perlu process semua
    // Tapi untuk validasi fetch data lainnya, gunakan indexes yang ada di Status New
    const expectedIndexes = statusNewIndexes
    console.log(`[C300-GPON-SNMP] Using ${expectedIndexes.size} indexes for validation (expected: ${expectedCount || 'unknown'})`)

    // Fetch Serial Number dengan expected indexes untuk validasi
    let sn: Record<string, string> = {}
    sn = await fetchWithFallbackAndRetry(oidSN, oidSNAlt1, 'Serial Number', expectedIndexes)

    // Early exit jika tidak ada ONU
    if (Object.keys(statusNew).length === 0 && Object.keys(sn).length === 0) {
      console.log(`[C300-GPON-SNMP] No ONUs found, skipping remaining SNMP queries`)
      return []
    }

    // Batch 2: Data tambahan hanya jika ada ONU
    // Fetch dengan retry mechanism dan validasi menggunakan expectedIndexes
    console.log(`[C300-GPON-SNMP] Fetching additional data with retry mechanism...`)

    const fetchStatusOld = async (): Promise<Record<string, string>> => {
      try {
        return await snmpGetBulkSimple(ipAddress, port, community, version, oidStatus, adaptiveTimeout)
      } catch (e: any) {
        console.warn(`[C300-GPON-SNMP] SNMP GETBULK failed for status (old): ${e.message || e}`)
        return {}
      }
    }

    const fetchName = async (): Promise<Record<string, string>> => {
      try {
        return await snmpGetBulkSimple(ipAddress, port, community, version, oidName, adaptiveTimeout)
      } catch (e: any) {
        console.warn(`[C300-GPON-SNMP] SNMP GETBULK failed for name: ${e.message || e}`)
        return {}
      }
    }

    // Fetch dengan retry dan validasi
    const additionalBatch = await Promise.all([
      fetchStatusOld(),
      fetchName(),
      fetchWithFallbackAndRetry(oidRxOltNew, null, 'RX OLT', expectedIndexes),
      fetchWithFallbackAndRetry(oidActualType, oidActualTypeAlt1, 'Actual Type', expectedIndexes),
    ])

    const [status, name, rxOltData, actualType] = additionalBatch

    // Batch 3: Optional data (non-blocking)
    // Gunakan timeout lebih pendek (1.5 menit) untuk optional data, skip jika timeout
    const optionalTimeout = 90000 // 1.5 menit untuk optional data (lebih cepat)
    const optionalData = await Promise.allSettled([
      snmpGetBulkSimple(ipAddress, port, community, version, oidRx, optionalTimeout),
      snmpGetBulkSimple(ipAddress, port, community, version, oidTx, optionalTimeout),
      snmpGetBulkSimple(ipAddress, port, community, version, oidDesc, optionalTimeout),
      snmpGetBulkSimple(ipAddress, port, community, version, oidReg, optionalTimeout),
      snmpGetBulkSimple(ipAddress, port, community, version, oidRxOnuNew, optionalTimeout),
      snmpGetBulkSimple(ipAddress, port, community, version, oidPppoe, optionalTimeout),
      fetchZteAnPonData(),
    ])

    const rx = optionalData[0].status === 'fulfilled' ? optionalData[0].value : {}
    const tx = optionalData[1].status === 'fulfilled' ? optionalData[1].value : {}
    const desc = optionalData[2].status === 'fulfilled' ? optionalData[2].value : {}
    const reg = optionalData[3].status === 'fulfilled' ? optionalData[3].value : {}
    const rxOnuNew = optionalData[4].status === 'fulfilled' ? optionalData[4].value : {}
    const pppoe = optionalData[5].status === 'fulfilled' ? optionalData[5].value : {}
    const zteAnPonData = optionalData[6].status === 'fulfilled' ? optionalData[6].value : ({} as Record<string, Record<string, string>>)

    // Log jumlah data yang di-fetch dari setiap OID
    console.log(`[C300-GPON-SNMP] Data fetched from SNMP:`)
    console.log(`[C300-GPON-SNMP]   - Status (old): ${Object.keys(status).length} entries`)
    console.log(`[C300-GPON-SNMP]   - Status (new): ${Object.keys(statusNew).length} entries`)
    console.log(`[C300-GPON-SNMP]   - RX (old): ${Object.keys(rx).length} entries`)
    console.log(`[C300-GPON-SNMP]   - TX: ${Object.keys(tx).length} entries`)
    console.log(`[C300-GPON-SNMP]   - Name: ${Object.keys(name).length} entries`)
    console.log(`[C300-GPON-SNMP]   - Description: ${Object.keys(desc).length} entries`)
    console.log(`[C300-GPON-SNMP]   - Register: ${Object.keys(reg).length} entries`)
    console.log(`[C300-GPON-SNMP]   - RX ONU (new): ${Object.keys(rxOnuNew).length} entries`)
    console.log(`[C300-GPON-SNMP]   - PPPoE: ${Object.keys(pppoe).length}`)

    // Determine calculated expected count dari data yang di-fetch (untuk logging)
    // Gunakan parameter expectedCount jika tersedia, jika tidak gunakan max dari data yang ada
    const calculatedExpectedCount = expectedCount || Math.max(
      Object.keys(statusNew).length,
      Object.keys(status).length,
      Object.keys(name).length
    )

    const statusCount = Object.keys(statusNew).length
    const nameCount = Object.keys(name).length
    const rxOltCount = Object.keys(rxOltData).length
    const rxOnuCount = Object.keys(rxOnuNew).length
    const serialCount = Object.keys(sn).length
    const typeCount = Object.keys(actualType).length

    console.log(`[C300-GPON-SNMP] Results: Expected ONUs=${calculatedExpectedCount}${expectedCount ? ` (from count: ${expectedCount})` : ''}, Status_OLD=${Object.keys(status).length}, Status_NEW=${statusCount}, RX_OLD=${Object.keys(rx).length}, RX_OLT_NEW=${rxOltCount}, RX_ONU_NEW=${rxOnuCount}, TX=${Object.keys(tx).length}, Name=${nameCount}, Desc=${Object.keys(desc).length}, SN=${serialCount}, Reg=${Object.keys(reg).length}, Type=${typeCount}, PPPoE=${Object.keys(pppoe).length}`)

    // Warning jika data tidak lengkap
    if (calculatedExpectedCount > 0) {
      const dataCompleteness = {
        status: (statusCount / calculatedExpectedCount * 100).toFixed(1),
        name: (nameCount / calculatedExpectedCount * 100).toFixed(1),
        rxOlt: (rxOltCount / calculatedExpectedCount * 100).toFixed(1),
        rxOnu: (rxOnuCount / calculatedExpectedCount * 100).toFixed(1),
        serial: (serialCount / calculatedExpectedCount * 100).toFixed(1),
        type: (typeCount / calculatedExpectedCount * 100).toFixed(1),
      }
      console.log(`[C300-GPON-SNMP] Data completeness: Status=${dataCompleteness.status}%, Name=${dataCompleteness.name}%, RX_OLT=${dataCompleteness.rxOlt}%, RX_ONU=${dataCompleteness.rxOnu}%, Serial=${dataCompleteness.serial}%, Type=${dataCompleteness.type}%`)

      // Warning jika completeness < 80%
      if (parseFloat(dataCompleteness.status) < 80) {
        console.warn(`[C300-GPON-SNMP] WARNING: Status data completeness is only ${dataCompleteness.status}% (expected ${calculatedExpectedCount}, got ${statusCount})`)
      }
      if (parseFloat(dataCompleteness.name) < 80) {
        console.warn(`[C300-GPON-SNMP] WARNING: Name data completeness is only ${dataCompleteness.name}% (expected ${calculatedExpectedCount}, got ${nameCount})`)
      }
      if (parseFloat(dataCompleteness.rxOlt) < 80) {
        console.warn(`[C300-GPON-SNMP] WARNING: RX_OLT data completeness is only ${dataCompleteness.rxOlt}% (expected ${calculatedExpectedCount}, got ${rxOltCount})`)
      }
      if (parseFloat(dataCompleteness.rxOnu) < 80) {
        console.warn(`[C300-GPON-SNMP] WARNING: RX_ONU data completeness is only ${dataCompleteness.rxOnu}% (expected ${calculatedExpectedCount}, got ${rxOnuCount})`)
      }
      if (parseFloat(dataCompleteness.serial) < 80) {
        console.warn(`[C300-GPON-SNMP] WARNING: Serial data completeness is only ${dataCompleteness.serial}% (expected ${calculatedExpectedCount}, got ${serialCount})`)
      }
      if (parseFloat(dataCompleteness.type) < 80) {
        console.warn(`[C300-GPON-SNMP] WARNING: Type data completeness is only ${dataCompleteness.type}% (expected ${calculatedExpectedCount}, got ${typeCount})`)
      }
    }

    // Debug: cek beberapa sample data untuk description
    if (Object.keys(desc).length > 0) {
      const sampleIndexes = Object.keys(desc).slice(0, 3)
      console.log(`[C300-GPON-SNMP] Sample Description data:`)
      for (const idx of sampleIndexes) {
        const descVal = desc[idx]
        console.log(`[C300-GPON-SNMP]   Index ${idx}: Desc="${descVal}"`)
      }
    } else {
      console.log(`[C300-GPON-SNMP] Warning: No description data found from OID ${oidDesc}`)
    }

    // Debug: cek beberapa sample data untuk PPPoE
    if (Object.keys(pppoe).length > 0) {
      const sampleIndexes = Object.keys(pppoe).slice(0, 3)
      console.log(`[C300-GPON-SNMP] Sample PPPoE data:`)
      for (const idx of sampleIndexes) {
        const pppoeVal = pppoe[idx]
        console.log(`[C300-GPON-SNMP]   Index ${idx}: PPPoE="${pppoeVal}"`)
      }
    } else {
      console.log(`[C300-GPON-SNMP] Warning: No PPPoE data found from OID ${oidPppoe}`)
    }

    // Debug: cek beberapa sample data untuk Status baru
    if (Object.keys(statusNew).length > 0) {
      const sampleIndexes = Object.keys(statusNew).slice(0, 5)
      console.log(`[C300-GPON-SNMP] Sample Status NEW data:`)
      for (const idx of sampleIndexes) {
        const statusVal = statusNew[idx]
        console.log(`[C300-GPON-SNMP]   Index ${idx}: Status="${statusVal}"`)
      }
    } else {
      console.log(`[C300-GPON-SNMP] Warning: No Status NEW data found from OID ${oidStatusNew}`)
    }

    // Debug: cek beberapa sample data untuk Status lama
    if (Object.keys(status).length > 0) {
      const sampleIndexes = Object.keys(status).slice(0, 5)
      console.log(`[C300-GPON-SNMP] Sample Status OLD data:`)
      for (const idx of sampleIndexes) {
        const statusVal = status[idx]
        console.log(`[C300-GPON-SNMP]   Index ${idx}: Status="${statusVal}"`)
      }
    }

    // Debug: cek beberapa sample data untuk melihat format index yang digunakan
    if (Object.keys(rxOltData).length > 0) {
      const sampleIndexes = Object.keys(rxOltData).slice(0, 10)
      console.log(`[C300-GPON-SNMP] Sample RX OLT data (first 10 indexes):`)
      for (const idx of sampleIndexes) {
        const rxOltVal = rxOltData[idx]
        console.log(`[C300-GPON-SNMP]   Index ${idx}: RX_OLT=${rxOltVal}`)
      }

      // Show samples from slot 8 and 9 if available
      const slot8Samples = Object.keys(rxOltData).filter(k => {
        const parts = k.split('.')
        if (parts.length >= 2) {
          const compositeIndex = parseInt(parts[0], 10)
          if (!isNaN(compositeIndex)) {
            const slot = (compositeIndex >> 16) & 0xFF
            return slot === 8
          }
        }
        return false
      }).slice(0, 5)

      if (slot8Samples.length > 0) {
        console.log(`[C300-GPON-SNMP] Sample RX OLT data from Slot 8 (first 5):`)
        for (const idx of slot8Samples) {
          const rxOltVal = rxOltData[idx]
          console.log(`[C300-GPON-SNMP]   Index ${idx}: RX_OLT=${rxOltVal}`)
        }
      } else {
        console.log(`[C300-GPON-SNMP] WARNING: No RX OLT data found for Slot 8 in SNMP response`)
      }

      const slot9Samples = Object.keys(rxOltData).filter(k => {
        const parts = k.split('.')
        if (parts.length >= 2) {
          const compositeIndex = parseInt(parts[0], 10)
          if (!isNaN(compositeIndex)) {
            const slot = (compositeIndex >> 16) & 0xFF
            return slot === 9
          }
        }
        return false
      }).slice(0, 5)

      if (slot9Samples.length > 0) {
        console.log(`[C300-GPON-SNMP] Sample RX OLT data from Slot 9 (first 5):`)
        for (const idx of slot9Samples) {
          const rxOltVal = rxOltData[idx]
          console.log(`[C300-GPON-SNMP]   Index ${idx}: RX_OLT=${rxOltVal}`)
        }
      } else {
        console.log(`[C300-GPON-SNMP] WARNING: No RX OLT data found for Slot 9 in SNMP response`)
      }
    }

    // Show sample serial number data
    if (Object.keys(sn).length > 0) {
      const sampleSNIndexes = Object.keys(sn).slice(0, 5)
      console.log(`[C300-GPON-SNMP] Sample Serial Number data (first 5 indexes):`)
      for (const idx of sampleSNIndexes) {
        const snVal = sn[idx]
        console.log(`[C300-GPON-SNMP]   Index ${idx}: SN=${snVal}`)
      }
    } else {
      console.log(`[C300-GPON-SNMP] WARNING: No Serial Number data found in SNMP response`)
    }

    // Show sample actual type data
    if (Object.keys(actualType).length > 0) {
      const sampleTypeIndexes = Object.keys(actualType).slice(0, 5)
      console.log(`[C300-GPON-SNMP] Sample Actual Type data (first 5 indexes):`)
      for (const idx of sampleTypeIndexes) {
        const typeVal = actualType[idx]
        console.log(`[C300-GPON-SNMP]   Index ${idx}: Type=${typeVal}`)
      }
    } else {
      console.log(`[C300-GPON-SNMP] WARNING: No Actual Type data found in SNMP response`)
    }


    // STEP 3: Process SEMUA ONU data dari statusNew
    // JANGAN bergantung pada Card/PON structure untuk filtering
    // Langsung proses SEMUA index dari statusNew untuk memastikan tidak ada yang terlewat
    // PROSES PARALLEL DENGAN CONTROLLED CONCURRENCY untuk efisiensi
    // Setiap ONU dipastikan datanya lengkap ter-baca sebelum diproses
    console.log(`[C300-GPON-SNMP] ========================================`)
    console.log(`[C300-GPON-SNMP] STEP 3: PROCESSING ALL ONU DATA (PARALLEL WITH CONCURRENCY CONTROL)`)
    console.log(`[C300-GPON-SNMP] ========================================`)

    const onus: Array<OnuSyncData> = []
    const allOnuIndexes = Object.keys(statusNew)

    // Warning jika statusNew tidak lengkap
    if (expectedCount && allOnuIndexes.length < expectedCount) {
      const missing = expectedCount - allOnuIndexes.length
      console.warn(`[C300-GPON-SNMP] WARNING: Status New incomplete! Processing ${allOnuIndexes.length} ONUs but expected ${expectedCount} ONUs (missing ${missing})`)
      console.warn(`[C300-GPON-SNMP] Will process all available ONUs from Status New`)
    }

    console.log(`[C300-GPON-SNMP] Processing ${allOnuIndexes.length} ONU(s) from statusNew${expectedCount ? ` (expected: ${expectedCount})` : ''}...`)
    console.log(`[C300-GPON-SNMP] Using parallel processing with controlled concurrency (5 concurrent ONUs)`)
    console.log(`[C300-GPON-SNMP] Each ONU is processed with retry mechanism to ensure complete data reading`)

    if (allOnuIndexes.length === 0) {
      console.warn(`[C300-GPON-SNMP] ERROR: No ONU indexes found in Status New! Cannot process any ONUs.`)
      return []
    }

    // Helper function untuk process single ONU dengan retry
    const processSingleOnu = async (idx: string, retryCount = 0): Promise<OnuSyncData | null> => {
      const maxRetries = 2

      try {
        const onuData = processOnuDataFromIndex(
          idx,
          oltId,
          statusNew,
          status,
          name,
          desc,
          sn,
          rx,
          tx,
          reg,
          pppoe,
          rxOltData,
          rxOnuNew,
          txOnuNew,
          actualType,
          zteAnPonData
        )

        // Validasi: pastikan data penting ada (name atau status atau serial)
        const hasData = onuData.name || onuData.status !== 'Unknown' || onuData.serialNumber
        if (!hasData && retryCount < maxRetries) {
          console.warn(`[C300-GPON-SNMP] ONU ${idx}: Data incomplete, retrying... (attempt ${retryCount + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, 100)) // Delay kecil sebelum retry
          return processSingleOnu(idx, retryCount + 1)
        }

        return onuData
      } catch (error: any) {
        if (retryCount < maxRetries) {
          console.warn(`[C300-GPON-SNMP] ONU ${idx}: Error processing, retrying... (attempt ${retryCount + 1}/${maxRetries}): ${error.message || error}`)
          await new Promise(resolve => setTimeout(resolve, 100)) // Delay kecil sebelum retry
          return processSingleOnu(idx, retryCount + 1)
        } else {
          console.warn(`[C300-GPON-SNMP] ONU ${idx}: Error after ${maxRetries} retries: ${error.message || error}`)
          return null
        }
      }
    }

    // Process semua ONU secara parallel dengan controlled concurrency
    // Concurrency limit: 5 ONU diproses bersamaan
    const concurrencyLimit = 5
    const allOnuIndexesArray = Array.from(allOnuIndexes)

    for (let i = 0; i < allOnuIndexesArray.length; i += concurrencyLimit) {
      const batch = allOnuIndexesArray.slice(i, i + concurrencyLimit)
      const batchNum = Math.floor(i / concurrencyLimit) + 1
      const totalBatches = Math.ceil(allOnuIndexesArray.length / concurrencyLimit)

      // Progress log setiap batch
      if (i > 0) {
        console.log(`[C300-GPON-SNMP] Progress: ${i}/${allOnuIndexesArray.length} ONUs processed... (batch ${batchNum - 1}/${totalBatches})`)
      }

      // Process batch secara parallel
      const batchResults = await Promise.all(
        batch.map(async (idx) => {
          const result = await processSingleOnu(idx)
          return result
        })
      )

      // Filter null results dan tambahkan ke onus array
      const validResults = batchResults.filter((result): result is OnuSyncData => result !== null)
      onus.push(...validResults)

      // Small delay antara batch untuk stabilitas (memberi waktu OLT untuk refresh)
      if (i + concurrencyLimit < allOnuIndexesArray.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    console.log(`[C300-GPON-SNMP] ========================================`)
    console.log(`[C300-GPON-SNMP] Processed all ${onus.length} ONUs from statusNew`)
    console.log(`[C300-GPON-SNMP] ========================================`)

    // Validasi cross-check: bandingkan jumlah ONU yang di-fetch dengan expected count
    if (expectedCount !== undefined) {
      const fetchedCount = onus.length
      const diff = Math.abs(fetchedCount - expectedCount)
      const diffPercentage = (diff / expectedCount) * 100

      console.log(`[C300-GPON-SNMP] ========================================`)
      console.log(`[C300-GPON-SNMP] CROSS-CHECK VALIDATION`)
      console.log(`[C300-GPON-SNMP] ========================================`)
      console.log(`[C300-GPON-SNMP] Expected count: ${expectedCount}`)
      console.log(`[C300-GPON-SNMP] Fetched count: ${fetchedCount}`)
      console.log(`[C300-GPON-SNMP] Difference: ${diff} (${diffPercentage.toFixed(1)}%)`)

      if (diffPercentage > 5) {
        console.warn(`[C300-GPON-SNMP] WARNING: Significant count mismatch (> 5%)!`)
        console.warn(`[C300-GPON-SNMP] Expected ${expectedCount} ONUs but fetched ${fetchedCount} ONUs`)
        console.warn(`[C300-GPON-SNMP] This might indicate incomplete data fetching.`)

        // Coba retry dengan getNext jika selisih terlalu besar
        // OPTIMASI: Lebih agresif menggunakan GET NEXT untuk menangani data yang terputus-putus
        if (fetchedCount < expectedCount && diffPercentage > 5) {
          console.log(`[C300-GPON-SNMP] Attempting retry with GET NEXT to fetch missing ONUs (data seems fragmented)...`)
          try {
            // Import snmpWalkWithGetNext untuk retry
            const { snmpWalkWithGetNext } = await import('@/lib/utils/snmp-helpers')

            // Retry dengan GET NEXT untuk menangani data yang terputus-putus
            const getNextResults = await snmpWalkWithGetNext(
              ipAddress,
              port,
              community,
              version,
              oidStatusNew,
              adaptiveTimeout,
              expectedCount
            )

            // Convert getNext results ke format Record<string, string>
            const retryResults: Record<string, string> = {}
            for (const result of getNextResults) {
              if (result.value !== null && result.value !== undefined) {
                const oidStr = result.oid.toString()
                const oidParts = oidStr.split('.')
                const baseOidParts = oidStatusNew.split('.').filter(p => p.length > 0)

                if (oidParts.length > baseOidParts.length) {
                  const index = oidParts.slice(baseOidParts.length).join('.')
                  let valueStr: string
                  if (Buffer.isBuffer(result.value)) {
                    valueStr = Array.from(result.value)
                      .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                      .join(' ')
                  } else {
                    valueStr = result.value.toString()
                  }
                  retryResults[index] = valueStr
                }
              }
            }

            const retryCount = Object.keys(retryResults).length
            console.log(`[C300-GPON-SNMP] GET NEXT retry returned ${retryCount} results (vs ${fetchedCount} from GETBULK)`)

            if (retryCount > fetchedCount) {
              const improvement = retryCount - fetchedCount
              console.log(`[C300-GPON-SNMP] GET NEXT found ${improvement} additional ONUs (${retryCount} vs ${fetchedCount})`)
              console.log(`[C300-GPON-SNMP] Merging GET NEXT results with existing data...`)

              // Merge results: gunakan retryResults untuk yang missing, keep existing untuk yang sudah ada
              for (const [index, value] of Object.entries(retryResults)) {
                if (!statusNew[index]) {
                  statusNew[index] = value
                  console.log(`[C300-GPON-SNMP] Added missing ONU index: ${index}`)
                }
              }

              console.log(`[C300-GPON-SNMP] After merge: ${Object.keys(statusNew).length} ONUs (was ${fetchedCount}, now ${Object.keys(statusNew).length})`)
            } else {
              console.warn(`[C300-GPON-SNMP] GET NEXT retry did not find more ONUs (${retryCount} vs ${fetchedCount})`)
            }
          } catch (retryError: any) {
            console.warn(`[C300-GPON-SNMP] GET NEXT retry failed: ${retryError.message || retryError}`)
          }
        }
      } else if (diffPercentage > 1) {
        console.log(`[C300-GPON-SNMP] Minor count mismatch (1-5%), acceptable but worth noting`)
      } else {
        console.log(`[C300-GPON-SNMP] Count matches expected! (difference < 1%)`)
      }
      console.log(`[C300-GPON-SNMP] ========================================`)
    } else {
      console.log(`[C300-GPON-SNMP] No expected count provided, skipping cross-check validation`)
    }

    // Final summary dengan metrics
    console.log(`[C300-GPON-SNMP] ========================================`)
    console.log(`[C300-GPON-SNMP] FINAL SUMMARY`)
    console.log(`[C300-GPON-SNMP] ========================================`)
    console.log(`[C300-GPON-SNMP] Successfully parsed ${onus.length} ONUs${expectedCount ? ` (expected: ${expectedCount})` : ''}`)

    // Calculate quality metrics
    const totalOnus = onus.length
    const qualityMetrics = {
      withName: onus.filter(o => o.name && !o.name.startsWith('ONU-')).length,
      withStatus: onus.filter(o => o.status !== 'Unknown').length,
      online: onus.filter(o => o.status === 'Online').length,
      withRxOlt: onus.filter(o => o.rxOlt && o.rxOlt !== 'N/A').length,
      withRxOnu: onus.filter(o => o.rxOnu && o.rxOnu !== 'N/A').length,
      withSerial: onus.filter(o => o.serialNumber).length,
      withDescription: onus.filter(o => o.description && !o.description.startsWith('Index:')).length,
      withValidSignal: onus.filter(o => {
        const rxOlt = parseFloat(o.rxOlt?.replace(/[^\d.-]/g, '') || '0')
        const rxOnu = parseFloat(o.rxOnu?.replace(/[^\d.-]/g, '') || '0')
        return !isNaN(rxOlt) && rxOlt > -30 && !isNaN(rxOnu) && rxOnu > -30
      }).length,
    }

    console.log(`[C300-GPON-SNMP] Quality Metrics:`)
    console.log(`[C300-GPON-SNMP]   - Total ONUs: ${totalOnus}`)
    console.log(`[C300-GPON-SNMP]   - With Name: ${qualityMetrics.withName} (${(qualityMetrics.withName / totalOnus * 100).toFixed(1)}%)`)
    console.log(`[C300-GPON-SNMP]   - Online: ${qualityMetrics.online} (${(qualityMetrics.online / totalOnus * 100).toFixed(1)}%)`)
    console.log(`[C300-GPON-SNMP]   - With Valid Signal: ${qualityMetrics.withValidSignal} (${(qualityMetrics.withValidSignal / totalOnus * 100).toFixed(1)}%)`)
    console.log(`[C300-GPON-SNMP]   - With RX OLT: ${qualityMetrics.withRxOlt} (${(qualityMetrics.withRxOlt / totalOnus * 100).toFixed(1)}%)`)
    console.log(`[C300-GPON-SNMP]   - With RX ONU: ${qualityMetrics.withRxOnu} (${(qualityMetrics.withRxOnu / totalOnus * 100).toFixed(1)}%)`)
    console.log(`[C300-GPON-SNMP]   - With Serial: ${qualityMetrics.withSerial} (${(qualityMetrics.withSerial / totalOnus * 100).toFixed(1)}%)`)
    console.log(`[C300-GPON-SNMP]   - With Description: ${qualityMetrics.withDescription} (${(qualityMetrics.withDescription / totalOnus * 100).toFixed(1)}%)`)
    console.log(`[C300-GPON-SNMP] ========================================`)

    return onus
  } catch (error: any) {
    console.error(`[C300-GPON-SNMP] Error:`, error)
    throw error
  }
}


export async function POST(req: NextRequest) {
  try {
        // Authentication check
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

    const body = await req.json()
    const { oltId, clear = false, forceRefresh = false } = body

    console.log(`[All-ONU] Starting sync from ${oltId ? 'specific' : 'all'} OLTs...`)
    console.log(`[All-ONU] Cache enabled: ${!forceRefresh} (TTL: ${SYNC_CACHE_TTL / 1000 / 60} minutes)`)

    const oltRepo = getOLTRepository()
    const onuRepo = getOnuRepository()

    let connectedOlts

    if (oltId) {
      // Sync specific OLT only
      const olt = await oltRepo.findById(oltId)
      if (!olt) {
        return NextResponse.json({
          success: false,
          error: `OLT with ID ${oltId} not found`,
        }, { status: 404 })
      }

      if (!olt.snmpConnected || !olt.snmpCommunityWrite || !olt.type?.toLowerCase().includes('c300')) {
        return NextResponse.json({
          success: false,
          error: `OLT ${olt.name} is not a C300 OLT with SNMP connected`,
        }, { status: 400 })
      }

      connectedOlts = [olt]
      console.log(`[All-ONU] Syncing specific OLT: ${olt.name} (${olt.ipAddress})`)
    } else {
      // Get all OLTs dengan SNMP connected (original behavior)
      connectedOlts = (await oltRepo.findAll()).filter(
        (olt) => olt.snmpConnected && olt.snmpCommunityWrite && olt.type?.toLowerCase().includes('c300')
      )
      console.log(`[All-ONU] Found ${connectedOlts.length} C300 OLTs with SNMP connected`)
    }

    if (connectedOlts.length === 0) {
      return NextResponse.json({
        success: false,
        error: oltId ? `OLT with ID ${oltId} is not available for sync` : 'Tidak ada OLT C300 yang terhubung via SNMP',
        synced: 0,
        total: 0,
      })
    }

    // Clear cache jika forceRefresh atau clear
    if (forceRefresh || clear) {
      if (forceRefresh) {
        console.log(`[All-ONU] Force refresh requested, clearing cache...`)
        if (oltId) {
          clearSyncCache(oltId)
        } else {
          clearSyncCache()
        }
      }
    }

    // Clear existing data only if explicitly requested (clear=true)
    // CATATAN: Untuk update normal, JANGAN gunakan clear=true
    // Update normal menggunakan upsert yang hanya update field yang berubah, tidak menghapus data
    if (clear) {
      console.log(`[All-ONU] WARNING: Clearing existing ONU data (clear=true was specified)...`)
      console.log(`[All-ONU] This will delete all existing ONUs before sync. Use with caution!`)
      for (const olt of connectedOlts) {
        await onuRepo.deleteByOltId(olt.id)
        console.log(`[All-ONU] Deleted existing ONUs for OLT ${olt.name}`)
      }
      console.log(`[All-ONU] Existing ONU data cleared`)
    } else {
      console.log(`[All-ONU] Using upsert mode: will update existing ONUs and insert new ones (no deletion before sync)`)
    }

    let totalSynced = 0
    const errors: string[] = []
    const cacheStats = {
      hits: 0,
      misses: 0,
    }

    // Sync ONU dari setiap OLT
    for (const olt of connectedOlts) {
      try {
        console.log(`[All-ONU] Trying C300 GPON parser (standard GPON MIB .1012) for OLT ${olt.name}...`)

        // Check cache terlebih dahulu (jika tidak force refresh)
        let onuData: Array<OnuSyncData> = []
        let fromCache = false

        if (!forceRefresh) {
          const cachedData = getCachedSyncData(olt.id, olt.ipAddress)
          if (cachedData) {
            onuData = cachedData
            fromCache = true
            cacheStats.hits++
            console.log(`[All-ONU] Using cached ONU data for OLT ${olt.name} (${onuData.length} ONUs)`)
          } else {
            cacheStats.misses++
          }
        } else {
          cacheStats.misses++
        }

        // Fetch dari SNMP jika tidak ada cache atau force refresh
        if (!fromCache) {
          console.log(`[All-ONU] Fetching ONU data from SNMP for OLT ${olt.name}...`)

          // Hitung expected count terlebih dahulu untuk validasi
          let expectedCount: number | undefined = undefined
          try {
            console.log(`[All-ONU] Counting ONUs from OLT ${olt.name}...`)
            expectedCount = await countOnuFromSNMP(
              olt.ipAddress,
              olt.snmpPort,
              olt.snmpCommunityWrite,
              olt.snmpVersion
            )
            console.log(`[All-ONU] Expected ONU count: ${expectedCount}`)
          } catch (countError: any) {
            console.warn(`[All-ONU] Failed to count ONUs: ${countError.message || countError}, continuing without expected count`)
          }

          onuData = await getC300GponOnuDataViaSNMP(
            olt.ipAddress,
            olt.snmpPort,
            olt.snmpCommunityWrite,
            olt.snmpVersion,
            olt.id,
            undefined,
            expectedCount
          )

          // Cache hasil fetch (jika berhasil)
          if (onuData.length > 0) {
            setCachedSyncData(olt.id, olt.ipAddress, onuData)
          }
        }

        if (onuData.length === 0) {
          console.log(`[All-ONU] No ONU data found for OLT ${olt.name} from SNMP`)
          console.log(`[All-ONU] Attempting to populate OIDs for existing ONUs in database...`)

          // Coba isi OID untuk ONU yang sudah ada di database
          try {
            const existingOnus = await onuRepo.findByOltId(olt.id)
            if (existingOnus.length > 0) {
              console.log(`[All-ONU] Found ${existingOnus.length} existing ONUs in database, populating OIDs...`)

              const { buildCompositeIndex } = await import('@/lib/services/onu-sync-helpers')
              let oidPopulatedCount = 0

              for (const existingOnu of existingOnus) {
                // Parse gponOnu untuk mendapatkan frame, slot, port, onu
                const match = existingOnu.gponOnu.match(/^(\d+)\/(\d+)\/(\d+):(\d+)$/)
                if (match) {
                  const frame = parseInt(match[1], 10)
                  const slot = parseInt(match[2], 10)
                  const port = parseInt(match[3], 10)
                  const onuId = parseInt(match[4], 10)

                  // Hitung composite index
                  const compositeIndex = buildCompositeIndex(frame, slot, port)
                  const idx = `${compositeIndex}.${onuId}`

                  // Build OID lengkap
                  const statusOid = `${ONU_OIDS.STATUS_NEW}.${idx}`
                  const rxOltOid = `${ONU_OIDS.RX_OLT_NEW}.${idx}`
                  const rxOnuOid = `${ONU_OIDS.RX_ONU_NEW}.${idx}`
                  const nameOid = `${ONU_OIDS.NAME}.${idx}`
                  const descOid = `${ONU_OIDS.DESC}.${idx}`

                  // Update OID jika belum ada
                  if (!existingOnu.statusOid) {
                    await onuRepo.upsert(olt.id, existingOnu.gponOnu, {
                      oltId: olt.id,
                      name: existingOnu.name,
                      gponOnu: existingOnu.gponOnu,
                      status: existingOnu.status,
                      statusOid,
                      rxOltOid,
                      rxOnuOid,
                      nameOid,
                      descOid,
                      compositeIndex,
                    })
                    oidPopulatedCount++
                  }
                }
              }

              console.log(`[All-ONU] Populated OIDs for ${oidPopulatedCount}/${existingOnus.length} existing ONUs`)
            }
          } catch (oidError: any) {
            console.error(`[All-ONU] Error populating OIDs for existing ONUs:`, oidError.message)
          }

          continue
        }

        console.log(`[All-ONU] Saving ${onuData.length} ONUs to database for OLT ${olt.name}...`)
        console.log(`[All-ONU] Using UPSERT: will update existing ONUs and insert new ones (no deletion)`)

        // Optimized database operations dengan batching
        // UPSERT: Update existing ONUs, insert new ones, skip unchanged ones
        console.log(`[All-ONU] Processing ${onuData.length} ONUs in optimized batches using upsert...`)
        let savedCount = 0
        const batchSize = 25 // Batch size untuk optimal performance

        for (let i = 0; i < onuData.length; i += batchSize) {
          const batch = onuData.slice(i, i + batchSize)
          const batchNum = Math.floor(i / batchSize) + 1
          const totalBatches = Math.ceil(onuData.length / batchSize)

          console.log(`[All-ONU] Processing batch ${batchNum}/${totalBatches} (${batch.length} ONUs)...`)

          // Process batch dengan controlled concurrency
          const concurrencyLimit = 5
          for (let j = 0; j < batch.length; j += concurrencyLimit) {
            const concurrentBatch = batch.slice(j, j + concurrencyLimit)

            await Promise.all(concurrentBatch.map(async (onu) => {
              try {
                await onuRepo.upsert(olt.id, onu.gponOnu, {
                  oltId: olt.id,
                  name: onu.name,
                  description: onu.description,
                  pppoe: onu.pppoe,
                  gponOnu: onu.gponOnu,
                  status: onu.status,
                  rxOlt: onu.rxOlt,
                  rxOnu: onu.rxOnu,
                  txOlt: onu.txOlt,
                  txOnu: onu.txOnu,
                  serialNumber: onu.serialNumber,
                  actualType: onu.actualType,
                  registerTime: onu.registerTime,
                  distance: onu.distance,
                  lastSeen: onu.lastSeen,
                  registrationMode: onu.registrationMode,
                  softwareVersion: onu.softwareVersion,
                  hardwareVersion: onu.hardwareVersion,
                  temperature: onu.temperature,
                  laserBiasCurrent: onu.laserBiasCurrent,
                  vendorId: onu.vendorId,
                  equipmentId: onu.equipmentId,
                  firmwareVersion: onu.firmwareVersion,
                  macAddress: onu.macAddress,
                  batteryStatus: onu.batteryStatus,
                  opticalTransceiverType: onu.opticalTransceiverType,
                  lastDeregTime: onu.lastDeregTime,
                  authMode: onu.authMode,
                  loid: onu.loid,
                  password: onu.password,
                  configState: onu.configState,
                  powerLevel: onu.powerLevel,
                  dyingGaspTime: onu.dyingGaspTime,
                  rxPowerStatus: onu.rxPowerStatus,
                  txPowerStatus: onu.txPowerStatus,
                  rxBytes: onu.rxBytes,
                  txBytes: onu.txBytes,
                  rxPackets: onu.rxPackets,
                  txPackets: onu.txPackets,
                  rxErrors: onu.rxErrors,
                  txErrors: onu.txErrors,
                  rxDrops: onu.rxDrops,
                  txDrops: onu.txDrops,
                  wifiEnable: onu.wifiEnable,
                  wifiSsid: onu.wifiSsid,
                  wifiSecurityMode: onu.wifiSecurityMode,
                  wifiChannel: onu.wifiChannel,
                  // SNMP OID fields untuk fast GET
                  statusOid: onu.statusOid || null,
                  rxOltOid: onu.rxOltOid || null,
                  rxOnuOid: onu.rxOnuOid || null,
                  nameOid: onu.nameOid || null,
                  descOid: onu.descOid || null,
                  compositeIndex: onu.compositeIndex || null,
                })
                savedCount++
              } catch (error: any) {
                console.error(`[All-ONU] Error saving ONU ${onu.gponOnu}:`, error.message)
              }
            }))
          }

          console.log(`[All-ONU] Batch ${batchNum}/${totalBatches} completed`)
        }

        // Update OLT onuLastSync
        await oltRepo.update(olt.id, {
          onuLastSync: new Date(),
        })

        totalSynced += savedCount
        console.log(`[All-ONU] Successfully saved ${savedCount}/${onuData.length} ONUs for OLT ${olt.name}`)
      } catch (error: any) {
        const errorMsg = `Error syncing OLT ${olt.name}: ${error.message}`
        console.error(`[All-ONU] ${errorMsg}`)
        errors.push(errorMsg)
      }
    }

    // Clear cache ONU setelah sync selesai untuk memastikan data fresh
    // Ini mencegah masalah jumlah data yang berubah-ubah karena cache stale
    if (totalSynced > 0) {
      console.log(`[All-ONU] Clearing ONU cache after sync (${totalSynced} ONUs synced)...`)
      clearOnuCache()
    }

    return NextResponse.json({
      success: true,
      message: oltId
        ? `Berhasil sync ${totalSynced} ONU dari OLT ${connectedOlts[0]?.name}`
        : `Berhasil sync ${totalSynced} ONU dari ${connectedOlts.length} OLT`,
      synced: totalSynced,
      total: connectedOlts.length,
      oltId: oltId, // Include oltId in response for tracking
      errors: errors.length > 0 ? errors : undefined,
      cache: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        ttl: SYNC_CACHE_TTL / 1000 / 60, // TTL dalam menit
      },
    })
  } catch (error: any) {
    console.error('[All-ONU] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Gagal sync ONU dari OLT',
      },
      { status: 500 }
    )
  }
}


