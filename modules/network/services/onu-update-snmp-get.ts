/**
 * Service untuk update data ONU menggunakan SNMP GET (bukan WALK)
 * Lebih efisien karena hanya mengambil field yang berubah saja
 */

import { snmpGet, snmpGetMultiple, snmpGetBulkSimple, snmpTable } from '@/lib/utils/snmp-helpers'
import type { OnuSyncData } from '@/lib/types/onu-sync'
import { ONU_OIDS } from '@/lib/utils/onu-oids'
import { onuCacheService } from './onu-cache-service';
import { buildCompositeIndex } from './onu-sync-helpers'
import {
  parseStatus,
  parseRxOlt,
  parseRxOnu,
  parseName,
  parseDescription,
  parseSerialNumber,
  parseActualType,
  parsePppoe,
} from '@/lib/utils/onu-data-parsers'

/**
 * Parse gponOnu string ke object {frame, slot, port, onu}
 * Format: "frame/slot/port:onu" atau "frame/slot/port"
 */
function parseGponOnuString(gponOnu: string): { frame: number; slot: number; port: number; onu: number } | null {
  // Support format: frame/slot/port:onu atau frame/slot/port
  const match = gponOnu.match(/^(\d+)\/(\d+)\/(\d+)(?::(\d+))?$/)
  if (!match) return null

  return {
    frame: parseInt(match[1], 10),
    slot: parseInt(match[2], 10),
    port: parseInt(match[3], 10),
    onu: match[4] ? parseInt(match[4], 10) : 0
  }
}

/**
 * Update data ONU spesifik menggunakan SNMP GET
 * Menggunakan format index yang sama seperti saat sync (compositeIndex.onuId)
 * @param ipAddress - IP address OLT
 * @param port - SNMP port
 * @param community - SNMP community
 * @param version - SNMP version
 * @param gponOnu - GPON ONU identifier (format: frame/slot/port:onu)
 * @param compositeIndex - Composite index untuk OID (optional, akan dihitung jika tidak ada)
 * @returns Data ONU yang di-update atau null jika gagal
 */
export async function updateOnuDataViaGet(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  gponOnu: string,
  compositeIndex?: number
): Promise<Partial<OnuSyncData> | null> {
  try {
    console.log(`[ONU-Update-Get] Updating ONU ${gponOnu} via SNMP GET...`)

    // Parse gponOnu untuk mendapatkan frame, slot, port, onu
    const parsed = parseGponOnuString(gponOnu)
    if (!parsed) {
      console.error(`[ONU-Update-Get] Invalid gponOnu format: ${gponOnu}`)
      return null
    }

    // Hitung composite index jika tidak ada
    if (!compositeIndex) {
      // Gunakan buildCompositeIndex untuk menghitung composite index
      compositeIndex = buildCompositeIndex(parsed.frame, parsed.slot, parsed.port)
    }

    const onuId = parsed.onu || 0

    // Format index sama seperti saat sync: compositeIndex.onuId
    // Contoh: 268566528.3 (untuk 1/3/1:3)
    const idx = `${compositeIndex}.${onuId}`

    // Build OIDs untuk field yang perlu di-update
    // Format OID: baseOid.compositeIndex.onuId (sama seperti saat sync)
    const oids = [
      `${ONU_OIDS.STATUS_NEW}.${idx}`, // Status: 1.3.6.1.4.1.3902.1012.3.28.2.1.4.268566528.3
      `${ONU_OIDS.RX_OLT_NEW}.${idx}`, // RX OLT: 1.3.6.1.4.1.3902.1015.1010.11.2.1.2.268566528.3
      `${ONU_OIDS.RX_ONU_NEW}.${idx}`, // RX ONU: 1.3.6.1.4.1.3902.1012.3.50.12.1.1.10.268566528.3
      `${ONU_OIDS.NAME}.${idx}`, // Name: 1.3.6.1.4.1.3902.1012.3.28.1.1.2.268566528.3
      `${ONU_OIDS.DESC}.${idx}`, // Description: 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3.268566528.3
    ]

    console.log(`[ONU-Update-Get] Using index format: ${idx} (compositeIndex: ${compositeIndex}, onuId: ${onuId})`)
    console.log(`[ONU-Update-Get] OIDs to fetch:`, oids)

    // Coba SNMP GET langsung (lebih cepat untuk sedikit ONU)
    const results = await snmpGetMultiple(ipAddress, port, community, version, oids, 5000) // Timeout lebih pendek untuk respons lebih cepat

    // Parse hasil - gunakan format OID yang sama seperti yang digunakan
    const statusOid = `${ONU_OIDS.STATUS_NEW}.${idx}`
    const rxOltOid = `${ONU_OIDS.RX_OLT_NEW}.${idx}`
    const rxOnuOid = `${ONU_OIDS.RX_ONU_NEW}.${idx}`
    const nameOid = `${ONU_OIDS.NAME}.${idx}`
    const descOid = `${ONU_OIDS.DESC}.${idx}`

    // Debug: log hasil SNMP GET
    console.log(`[ONU-Update-Get] SNMP GET results for ${gponOnu} (idx: ${idx}):`)
    console.log(`[ONU-Update-Get]   Status OID: ${statusOid} = ${results[statusOid] || 'null'}`)
    console.log(`[ONU-Update-Get]   RX OLT OID: ${rxOltOid} = ${results[rxOltOid] || 'null'}`)
    console.log(`[ONU-Update-Get]   RX ONU OID: ${rxOnuOid} = ${results[rxOnuOid] || 'null'}`)
    console.log(`[ONU-Update-Get]   Name OID: ${nameOid} = ${results[nameOid] || 'null'}`)
    console.log(`[ONU-Update-Get]   Desc OID: ${descOid} = ${results[descOid] || 'null'}`)

    // Debug: log semua hasil untuk melihat format yang diterima
    if (Object.keys(results).length > 0) {
      console.log(`[ONU-Update-Get] All received OIDs:`, Object.keys(results))
    }

    // Cek apakah ada data yang berhasil diambil (gunakan statusOid, rxOltOid, dll yang sudah didefinisikan)
    const hasAnyDataAfterFallback = results[statusOid] || results[rxOltOid] || results[rxOnuOid] || results[nameOid] || results[descOid]

    if (!hasAnyDataAfterFallback) {
      console.warn(`[ONU-Update-Get] WARNING: No data retrieved from SNMP GET for ${gponOnu} (idx: ${idx})`)
      console.warn(`[ONU-Update-Get] Tried OIDs:`)
      console.warn(`[ONU-Update-Get]   - Status: ${statusOid} = ${results[statusOid] || 'null (No Such Instance)'}`)
      console.warn(`[ONU-Update-Get]   - RX OLT: ${rxOltOid} = ${results[rxOltOid] || 'null (No Such Instance)'}`)
      console.warn(`[ONU-Update-Get]   - RX ONU: ${rxOnuOid} = ${results[rxOnuOid] || 'null (No Such Instance)'}`)
      console.warn(`[ONU-Update-Get]   - Name: ${nameOid} = ${results[nameOid] || 'null (No Such Instance)'}`)
      console.warn(`[ONU-Update-Get]   - Desc: ${descOid} = ${results[descOid] || 'null (No Such Instance)'}`)
      console.warn(`[ONU-Update-Get] Possible reasons:`)
      console.warn(`[ONU-Update-Get]   1. ONU is offline or not registered (most common)`)
      console.warn(`[ONU-Update-Get]   2. OID format incorrect (compositeIndex: ${compositeIndex}, onuId: ${onuId})`)
      console.warn(`[ONU-Update-Get]   3. OLT not responding or SNMP timeout`)
      console.warn(`[ONU-Update-Get]   4. ONU data not available at these OIDs (different OLT model/firmware)`)
      console.warn(`[ONU-Update-Get] Keeping existing database data for ${gponOnu}`)
      return null // Return null jika tidak ada data sama sekali - akan tetap menggunakan data database
    }

    const updatedData: Partial<OnuSyncData> = {
      gponOnu,
    }

    // Parse status - parseStatus membutuhkan 2 parameter (statusValueNew, statusValue)
    const statusValueNew = results[statusOid] || undefined
    if (statusValueNew) {
      const parsedStatus = parseStatus(statusValueNew, undefined)
      updatedData.status = parsedStatus
      console.log(`[ONU-Update-Get] Status parsed: ${statusValueNew} -> ${parsedStatus}`)
    } else {
      console.warn(`[ONU-Update-Get] No status data from SNMP GET for ${gponOnu}`)
    }

    // Parse RX OLT - parseRxOlt membutuhkan 2 parameter (rxOltNewValue, rxValue)
    const rxOltNewValue = results[rxOltOid] || undefined
    if (rxOltNewValue) {
      updatedData.rxOlt = parseRxOlt(rxOltNewValue, undefined)
    }

    // Parse RX ONU - parseRxOnu membutuhkan 2 parameter (rxOnuNewValue, txValue)
    const rxOnuNewValue = results[rxOnuOid] || undefined
    if (rxOnuNewValue) {
      updatedData.rxOnu = parseRxOnu(rxOnuNewValue, undefined)
    }

    // Parse name - parseName membutuhkan 2 parameter (nameValue, idx)
    const nameValue = results[nameOid] || undefined
    if (nameValue) {
      updatedData.name = parseName(nameValue, idx)
    }

    // Parse description - parseDescription membutuhkan 2 parameter (descValue, idx)
    const descValue = results[descOid] || undefined
    if (descValue) {
      updatedData.description = parseDescription(descValue, idx)
    }

    // Log hasil parsing
    console.log(`[ONU-Update-Get] Parsed data for ${gponOnu}:`, {
      status: updatedData.status,
      rxOlt: updatedData.rxOlt,
      rxOnu: updatedData.rxOnu,
      name: updatedData.name,
      description: updatedData.description,
    })

    // Pastikan minimal ada status yang berhasil di-parse
    if (!updatedData.status) {
      console.warn(`[ONU-Update-Get] WARNING: No status parsed for ${gponOnu}, returning null`)
      return null
    }

    console.log(`[ONU-Update-Get] Successfully updated ONU ${gponOnu} via SNMP GET`)
    return updatedData
  } catch (error: any) {
    console.error(`[ONU-Update-Get] Error updating ONU ${gponOnu}:`, error.message || error)
    return null
  }
}

/**
 * Update multiple ONUs menggunakan SNMP GET langsung (lebih cepat untuk sedikit ONU)
 * Untuk sedikit ONU (misalnya 5-10), SNMP GET langsung lebih cepat daripada GETBULK semua data
 * @param ipAddress - IP address OLT
 * @param port - SNMP port
 * @param community - SNMP community
 * @param version - SNMP version
 * @param onuList - Array of {gponOnu, compositeIndex?}
 * @returns Array of updated data
 */
export async function updateMultipleOnusViaGet(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  onuList: Array<{ gponOnu: string; compositeIndex?: number }>
): Promise<Array<Partial<OnuSyncData>>> {
  if (onuList.length === 0) {
    return []
  }

  // Untuk sedikit ONU (<= 10), gunakan parallel GET langsung (lebih cepat)
  // Untuk banyak ONU (> 10), bisa pertimbangkan GETBULK batch
  if (onuList.length <= 10) {
    console.log(`[ONU-Update-Get] Updating ${onuList.length} ONUs via parallel SNMP GET (fast mode)...`)

    // Process dalam parallel dengan limit concurrency
    const results: Array<Partial<OnuSyncData>> = []
    const batchSize = 5 // Process 5 ONUs at a time untuk menghindari overload
    for (let i = 0; i < onuList.length; i += batchSize) {
      const batch = onuList.slice(i, i + batchSize)
      const batchPromises = batch.map(onu =>
        updateOnuDataViaGet(ipAddress, port, community, version, onu.gponOnu, onu.compositeIndex)
      )
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.filter(r => r !== null) as Partial<OnuSyncData>[])
    }

    console.log(`[ONU-Update-Get] Successfully updated ${results.length}/${onuList.length} ONUs via parallel GET`)
    return results
  }

  // Untuk banyak ONU, gunakan GETBULK (tapi ini jarang terjadi karena biasanya hanya update ONU yang ditampilkan)
  console.log(`[ONU-Update-Get] Updating ${onuList.length} ONUs via GETBULK (batch mode)...`)

  try {
    // Parse semua ONU untuk mendapatkan index
    const onuIndexes = new Map<string, { gponOnu: string; idx: string }>()
    for (const onu of onuList) {
      const parsed = parseGponOnuString(onu.gponOnu)
      if (!parsed) continue

      const compositeIndex = onu.compositeIndex || buildCompositeIndex(parsed.frame, parsed.slot, parsed.port)
      const onuId = parsed.onu || 0
      const idx = `${compositeIndex}.${onuId}`
      onuIndexes.set(idx, { gponOnu: onu.gponOnu, idx })
    }

    if (onuIndexes.size === 0) {
      console.warn(`[ONU-Update-Get] No valid ONUs to update`)
      return []
    }

    // Fetch semua data menggunakan GETBULK
    const [statusData, rxOltData, rxOnuData, nameData, descData] = await Promise.all([
      snmpGetBulkSimple(ipAddress, port, community, version, ONU_OIDS.STATUS_NEW, 30000),
      snmpGetBulkSimple(ipAddress, port, community, version, ONU_OIDS.RX_OLT_NEW, 30000),
      snmpGetBulkSimple(ipAddress, port, community, version, ONU_OIDS.RX_ONU_NEW, 30000),
      snmpGetBulkSimple(ipAddress, port, community, version, ONU_OIDS.NAME, 30000),
      snmpGetBulkSimple(ipAddress, port, community, version, ONU_OIDS.DESC, 30000),
    ])

    // Process setiap ONU berdasarkan index
    const results: Array<Partial<OnuSyncData>> = []
    for (const { gponOnu, idx } of onuIndexes.values()) {
      const updatedData: Partial<OnuSyncData> = { gponOnu }

      // Parse data dari GETBULK results
      const statusValueNew = statusData[idx] || undefined
      if (statusValueNew) {
        updatedData.status = parseStatus(statusValueNew, undefined)
      }

      const rxOltNewValue = rxOltData[idx] || undefined
      if (rxOltNewValue) {
        updatedData.rxOlt = parseRxOlt(rxOltNewValue, undefined)
      }

      const rxOnuNewValue = rxOnuData[idx] || undefined
      if (rxOnuNewValue) {
        updatedData.rxOnu = parseRxOnu(rxOnuNewValue, undefined)
      }

      const nameValue = nameData[idx] || undefined
      if (nameValue) {
        updatedData.name = parseName(nameValue, idx)
      }

      const descValue = descData[idx] || undefined
      if (descValue) {
        updatedData.description = parseDescription(descValue, idx)
      }

      // Hanya return jika ada minimal status
      if (updatedData.status) {
        results.push(updatedData)
      }
    }

    console.log(`[ONU-Update-Get] Successfully updated ${results.length}/${onuList.length} ONUs via GETBULK`)
    return results
  } catch (error: any) {
    console.error(`[ONU-Update-Get] Error updating multiple ONUs:`, error.message || error)
    return []
  }
}

/**
 * Update multiple ONUs menggunakan OID yang sudah tersimpan di database (FASTEST)
 * Menggunakan OID langsung untuk SNMP GET tanpa perlu menghitung composite index
 * @param ipAddress - IP address OLT
 * @param port - SNMP port
 * @param community - SNMP community
 * @param version - SNMP version
 * @param onuList - Array of {gponOnu, statusOid, rxOltOid, rxOnuOid, nameOid, descOid, compositeIndex?}
 * @returns Array of updated data
 */
export async function updateMultipleOnusViaGetWithOids(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  onuList: Array<{
    gponOnu: string
    statusOid: string | null
    rxOltOid: string | null
    rxOnuOid: string | null
    nameOid: string | null
    descOid: string | null
    compositeIndex?: number | null
  }>
): Promise<Array<Partial<OnuSyncData>>> {
  if (onuList.length === 0) {
    return []
  }

  console.log(`[ONU-Update-Get] Updating ${onuList.length} ONUs via SNMP GET using stored OIDs (fastest mode)...`)

  // Collect semua OID yang valid
  const allOids: string[] = []
  const onuOidMap = new Map<string, {
    gponOnu: string
    statusOid?: string
    rxOltOid?: string
    rxOnuOid?: string
    nameOid?: string
    descOid?: string
  }>()

  for (const onu of onuList) {
    const oids: string[] = []
    if (onu.statusOid) oids.push(onu.statusOid)
    if (onu.rxOltOid) oids.push(onu.rxOltOid)
    if (onu.rxOnuOid) oids.push(onu.rxOnuOid)
    if (onu.nameOid) oids.push(onu.nameOid)
    if (onu.descOid) oids.push(onu.descOid)

    if (oids.length > 0) {
      allOids.push(...oids)
      onuOidMap.set(onu.gponOnu, {
        gponOnu: onu.gponOnu,
        statusOid: onu.statusOid || undefined,
        rxOltOid: onu.rxOltOid || undefined,
        rxOnuOid: onu.rxOnuOid || undefined,
        nameOid: onu.nameOid || undefined,
        descOid: onu.descOid || undefined,
      })
    }
  }

  if (allOids.length === 0) {
    console.warn(`[ONU-Update-Get] No valid OIDs found, falling back to regular GET...`)
    // Fallback ke regular GET jika tidak ada OID
    return await updateMultipleOnusViaGet(
      ipAddress,
      port,
      community,
      version,
      onuList.map(onu => ({ gponOnu: onu.gponOnu, compositeIndex: onu.compositeIndex || undefined }))
    )
  }

  // Fetch semua OID sekaligus menggunakan SNMP GET multiple
  const results = await snmpGetMultiple(ipAddress, port, community, version, allOids, 5000)

  // Process hasil untuk setiap ONU
  const updatedOnus: Array<Partial<OnuSyncData>> = []
  for (const [gponOnu, oids] of onuOidMap.entries()) {
    const updatedData: Partial<OnuSyncData> = { gponOnu }

    // Parse status
    if (oids.statusOid && results[oids.statusOid]) {
      updatedData.status = parseStatus(results[oids.statusOid]!, undefined)
    }

    // Parse RX OLT
    if (oids.rxOltOid && results[oids.rxOltOid]) {
      updatedData.rxOlt = parseRxOlt(results[oids.rxOltOid]!, undefined)
    }

    // Parse RX ONU
    if (oids.rxOnuOid && results[oids.rxOnuOid]) {
      updatedData.rxOnu = parseRxOnu(results[oids.rxOnuOid]!, undefined)
    }

    // Parse name
    if (oids.nameOid && results[oids.nameOid]) {
      // Extract idx dari OID untuk parseName
      const idxMatch = oids.nameOid.match(/\.(\d+\.\d+)$/)
      const idx = idxMatch ? idxMatch[1] : ''
      updatedData.name = parseName(results[oids.nameOid]!, idx)
    }

    // Parse description
    if (oids.descOid && results[oids.descOid]) {
      // Extract idx dari OID untuk parseDescription
      const idxMatch = oids.descOid.match(/\.(\d+\.\d+)$/)
      const idx = idxMatch ? idxMatch[1] : ''
      updatedData.description = parseDescription(results[oids.descOid]!, idx)
    }

    // Hanya return jika ada minimal status
    if (updatedData.status) {
      updatedOnus.push(updatedData)
    }
  }

  console.log(`[ONU-Update-Get] Successfully updated ${updatedOnus.length}/${onuList.length} ONUs via OID-based GET`)
  return updatedOnus
}


/**
 * Update multiple ONUs menggunakan SNMP TABLE (paling efisien untuk banyak ONU)
 * Menggunakan SNMP TABLE operation untuk mengambil beberapa kolom sekaligus dalam satu operasi
 * Lebih efisien daripada multiple GET karena menggunakan GETBULK untuk semua kolom sekaligus
 * @param ipAddress - IP address OLT
 * @param port - SNMP port
 * @param community - SNMP community
 * @param version - SNMP version
 * @param onuList - Array of {gponOnu, compositeIndex?}
 * @returns Array of updated data
 */
export async function updateMultipleOnusViaTable(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  onuList: Array<{ gponOnu: string; compositeIndex?: number }>
): Promise<Array<Partial<OnuSyncData>>> {
  if (onuList.length === 0) {
    return []
  }

  console.log(`[ONU-Update-Table] Updating ${onuList.length} ONUs via SNMP TABLE (most efficient for many ONUs)...`)

  try {
    // Gunakan SNMP TABLE untuk mengambil semua kolom sekaligus menggunakan GETBULK
    // Ini lebih efisien daripada multiple GET karena mengambil semua data dalam satu operasi

    // Base OIDs untuk setiap kolom
    const statusBaseOid = "1.3.6.1.4.1.3902.1012.3.28.2.1"
    const rxOltBaseOid = "1.3.6.1.4.1.3902.1015.1010.11.2.1"
    const rxOnuBaseOid = "1.3.6.1.4.1.3902.1012.3.50.12.1.1"
    const nameBaseOid = "1.3.6.1.4.1.3902.1012.3.28.1.1"
    const descBaseOid = "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1"

    // Fetch semua kolom secara paralel menggunakan SNMP TABLE (GETBULK)
    const [statusTable, rxOltTable, rxOnuTable, nameTable, descTable] = await Promise.all([
      snmpTable(ipAddress, port, community, version, statusBaseOid, ['4'], 30000).catch(() => ({} as Record<string, string>)),
      snmpTable(ipAddress, port, community, version, rxOltBaseOid, ['2'], 30000).catch(() => ({} as Record<string, string>)),
      snmpTable(ipAddress, port, community, version, rxOnuBaseOid, ['10'], 30000).catch(() => ({} as Record<string, string>)),
      snmpTable(ipAddress, port, community, version, nameBaseOid, ['2'], 30000).catch(() => ({} as Record<string, string>)),
      snmpTable(ipAddress, port, community, version, descBaseOid, ['3'], 30000).catch(() => ({} as Record<string, string>)),
    ])

    console.log(`[ONU-Update-Table] Retrieved tables: Status=${Object.keys(statusTable).length}, RX_OLT=${Object.keys(rxOltTable).length}, RX_ONU=${Object.keys(rxOnuTable).length}, Name=${Object.keys(nameTable).length}, Desc=${Object.keys(descTable).length}`)

    // Process hasil untuk setiap ONU
    const updatedOnus: Array<Partial<OnuSyncData>> = []

    for (const onu of onuList) {
      const parsed = parseGponOnuString(onu.gponOnu)
      if (!parsed) {
        console.warn(`[ONU-Update-Table] Invalid gponOnu format: ${onu.gponOnu}`)
        continue
      }

      const compositeIndex = onu.compositeIndex || buildCompositeIndex(parsed.frame, parsed.slot, parsed.port)
      const onuId = parsed.onu || 0
      const idx = `${compositeIndex}.${onuId}`

      const updatedData: Partial<OnuSyncData> = { gponOnu: onu.gponOnu }

      // Extract data dari tabel (format: "columnOid.index")
      const statusKey = `4.${idx}`
      const rxOltKey = `2.${idx}`
      const rxOnuKey = `10.${idx}`
      const nameKey = `2.${idx}`
      const descKey = `3.${idx}`

      // Parse status
      if (statusTable[statusKey]) {
        updatedData.status = parseStatus(statusTable[statusKey], undefined)
      }

      // Parse RX OLT
      if (rxOltTable[rxOltKey]) {
        updatedData.rxOlt = parseRxOlt(rxOltTable[rxOltKey], undefined)
      }

      // Parse RX ONU
      if (rxOnuTable[rxOnuKey]) {
        updatedData.rxOnu = parseRxOnu(rxOnuTable[rxOnuKey], undefined)
      }

      // Parse name
      if (nameTable[nameKey]) {
        updatedData.name = parseName(nameTable[nameKey], idx)
      }

      // Parse description
      if (descTable[descKey]) {
        updatedData.description = parseDescription(descTable[descKey], idx)
      }

      // Hanya return jika ada minimal status
      if (updatedData.status) {
        updatedOnus.push(updatedData)
      }
    }

    console.log(`[ONU-Update-Table] Successfully updated ${updatedOnus.length}/${onuList.length} ONUs via SNMP TABLE`)
    return updatedOnus
  } catch (error: any) {
    console.error(`[ONU-Update-Table] Error:`, error.message || error)
    // Fallback ke GET multiple jika TABLE gagal
    console.log(`[ONU-Update-Table] Falling back to GET multiple...`)
    return await updateMultipleOnusViaGet(ipAddress, port, community, version, onuList)
  }
}
