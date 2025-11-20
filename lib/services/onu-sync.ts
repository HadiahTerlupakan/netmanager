/**
 * Service untuk sync ONU data dari SNMP ke database
 * Digunakan oleh scheduler untuk polling data ONU secara berkala
 */

import { getOLTRepository, getOnuRepository } from '@/lib/repositories'
import { getC300GponOnuDataViaSNMP } from '@/app/api/onus/sync/route'

/**
 * Sync ONU data dari semua OLT yang terhubung via SNMP
 * @returns Jumlah total ONU yang berhasil di-sync
 */
export async function syncAllOnuData(): Promise<number> {
  const oltRepo = getOLTRepository()
  const onuRepo = getOnuRepository()

  // Get all OLTs dengan SNMP connected dan onuSyncEnabled = true
  const olts = await oltRepo.findAll()
  const connectedOlts = olts.filter(
    (olt) =>
      olt.snmpConnected &&
      olt.snmpCommunityWrite &&
      olt.type?.toLowerCase().includes('c300') &&
      olt.onuSyncEnabled !== false // Default true, hanya skip jika explicitly false
  )

  if (connectedOlts.length === 0) {
    console.log('[ONU-Sync] No C300 OLTs with SNMP connected and sync enabled')
    return 0
  }

  console.log(`[ONU-Sync] Found ${connectedOlts.length} C300 OLTs with SNMP connected and sync enabled`)

  let totalSynced = 0
  const errors: string[] = []

  // Sync ONU dari setiap OLT
  for (const olt of connectedOlts) {
    try {
      console.log(`[ONU-Sync] Syncing ONU data from OLT ${olt.name} (${olt.ipAddress})...`)

      const onuData = await getC300GponOnuDataViaSNMP(
        olt.ipAddress,
        olt.snmpPort,
        olt.snmpCommunityWrite,
        olt.snmpVersion,
        olt.id
      )

      if (onuData.length === 0) {
        console.log(`[ONU-Sync] No ONU data found for OLT ${olt.name}`)
        continue
      }

      console.log(`[ONU-Sync] Saving ${onuData.length} ONUs to database for OLT ${olt.name}...`)

      // Upsert setiap ONU
      let savedCount = 0
      for (const onu of onuData) {
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
            serialNumber: onu.serialNumber,
            actualType: onu.actualType,
            lastSeen: new Date(), // Update last seen time
          })
          savedCount++
        } catch (error: any) {
          console.error(`[ONU-Sync] Error saving ONU ${onu.gponOnu}:`, error.message)
        }
      }

      // Update OLT onuLastSync
      await oltRepo.update(olt.id, {
        onuLastSync: new Date(),
      })

      totalSynced += savedCount
      console.log(`[ONU-Sync] Successfully saved ${savedCount}/${onuData.length} ONUs for OLT ${olt.name}`)
    } catch (error: any) {
      const errorMsg = `Error syncing OLT ${olt.name}: ${error.message}`
      console.error(`[ONU-Sync] ${errorMsg}`)
      errors.push(errorMsg)
      // Continue dengan OLT berikutnya
    }
  }

  if (errors.length > 0) {
    console.warn(`[ONU-Sync] Completed with ${errors.length} errors:`, errors)
  }

  console.log(`[ONU-Sync] Total synced: ${totalSynced} ONUs from ${connectedOlts.length} OLTs`)
  return totalSynced
}

/**
 * Sync ONU data dari OLT tertentu
 * @param oltId - OLT ID
 * @returns Jumlah ONU yang berhasil di-sync
 */
export async function syncOnuDataByOltId(oltId: string): Promise<number> {
  const oltRepo = getOLTRepository()
  const onuRepo = getOnuRepository()

  const olt = await oltRepo.findById(oltId)
  if (!olt) {
    throw new Error(`OLT with ID ${oltId} not found`)
  }

  if (!olt.snmpConnected || !olt.snmpCommunityWrite) {
    throw new Error(`OLT ${olt.name} is not connected via SNMP`)
  }

  if (!olt.type?.toLowerCase().includes('c300')) {
    throw new Error(`OLT ${olt.name} is not a C300 OLT`)
  }

  if (olt.onuSyncEnabled === false) {
    throw new Error(`ONU sync is disabled for OLT ${olt.name}`)
  }

  console.log(`[ONU-Sync] Syncing ONU data from OLT ${olt.name} (${olt.ipAddress})...`)

  const onuData = await getC300GponOnuDataViaSNMP(
    olt.ipAddress,
    olt.snmpPort,
    olt.snmpCommunityWrite,
    olt.snmpVersion,
    olt.id
  )

  if (onuData.length === 0) {
    console.log(`[ONU-Sync] No ONU data found for OLT ${olt.name}`)
    return 0
  }

  console.log(`[ONU-Sync] Saving ${onuData.length} ONUs to database for OLT ${olt.name}...`)

  // Upsert setiap ONU
  let savedCount = 0
  for (const onu of onuData) {
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
        serialNumber: onu.serialNumber,
        actualType: onu.actualType,
        lastSeen: new Date(),
      })
      savedCount++
    } catch (error: any) {
      console.error(`[ONU-Sync] Error saving ONU ${onu.gponOnu}:`, error.message)
    }
  }

  // Update OLT onuLastSync
  await oltRepo.update(olt.id, {
    onuLastSync: new Date(),
  })

  console.log(`[ONU-Sync] Successfully saved ${savedCount}/${onuData.length} ONUs for OLT ${olt.name}`)
  return savedCount
}

