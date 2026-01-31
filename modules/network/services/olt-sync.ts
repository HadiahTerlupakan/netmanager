/**
 * Service untuk sync data OLT dari SNMP ke database
 */

import { getOLTRepository } from '@/lib/repositories'

/**
 * Sync data OLT dari SNMP ke database
 * @param oltId - ID OLT yang akan di-sync
 * @returns true jika berhasil
 */
export async function syncOltDataFromSnmp(oltId: string): Promise<boolean> {
  const oltRepo = getOLTRepository()

  try {
    // Get OLT data
    const olt = await oltRepo.findById(oltId)
    if (!olt) {
      throw new Error(`OLT with id ${oltId} not found`)
    }

    // Check if SNMP is connected
    if (!olt.snmpConnected || !olt.snmpCommunityWrite) {
      console.log(`[OLT-Sync] OLT ${olt.name} (${olt.ipAddress}) SNMP not connected, skipping sync`)
      return false
    }

    console.log(`[OLT-Sync] Starting sync for OLT ${olt.name} (${olt.ipAddress})...`)

    // Import dan call fungsi sync langsung (untuk menghindari auth issues)
    const { syncOltDataDirect } = await import('./olt-sync-direct')
    return await syncOltDataDirect(oltId)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[OLT-Sync] Error syncing OLT ${oltId}:`, message)
    return false
  }
}

/**
 * Sync data dari semua OLT yang terhubung
 * @returns Jumlah OLT yang berhasil di-sync
 */
export async function syncAllOltData(): Promise<number> {
  const oltRepo = getOLTRepository()

  try {
    // Get all OLTs that have SNMP connected
    const olts = await oltRepo.findAll()
    const connectedOlts = olts.filter((olt) => olt.snmpConnected && olt.snmpCommunityWrite)

    console.log(`[OLT-Sync] Starting sync for ${connectedOlts.length} OLTs...`)

    let syncedCount = 0
    for (const olt of connectedOlts) {
      try {
        const success = await syncOltDataFromSnmp(olt.id)
        if (success) syncedCount++
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[OLT-Sync] Error syncing OLT ${olt.name}:`, message)
      }
    }

    console.log(`[OLT-Sync] Completed sync for all OLTs. Successfully synced: ${syncedCount}/${connectedOlts.length}`)
    return syncedCount
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[OLT-Sync] Error in syncAllOltData:`, message)
    throw error
  }
}

