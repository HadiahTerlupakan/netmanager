/**
 * Service untuk sync data ONU dari SNMP ke database
 */

import { getOLTRepository } from '@/lib/repositories'
import { getOnuRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import type { IOLTRepository } from '@/lib/repositories'

// Import fungsi SNMP dari route.ts
// Kita perlu memindahkan fungsi SNMP ke file terpisah agar bisa digunakan di sini
// Untuk sementara, kita akan import dari route.ts

/**
 * Sync data ONU dari OLT ke database
 * @param oltId - ID OLT yang akan di-sync
 * @returns Jumlah ONU yang berhasil di-sync
 */
export async function syncOnuDataFromOlt(oltId: string): Promise<number> {
  const oltRepo = getOLTRepository()
  const onuRepo = getOnuRepository()

  try {
    // Get OLT data
    const olt = await oltRepo.findById(oltId)
    if (!olt) {
      throw new Error(`OLT with id ${oltId} not found`)
    }

    // Check if SNMP is connected
    if (!olt.snmpConnected || !olt.snmpCommunityWrite) {
      console.log(`[ONU-Sync] OLT ${olt.name} (${olt.ipAddress}) SNMP not connected, skipping sync`)
      return 0
    }

    // Check if sync is enabled
    if (olt.onuSyncEnabled === false) {
      console.log(`[ONU-Sync] OLT ${olt.name} (${olt.ipAddress}) sync disabled, skipping`)
      return 0
    }

    console.log(`[ONU-Sync] Starting sync for OLT ${olt.name} (${olt.ipAddress})...`)

    // Import fungsi SNMP secara dinamis untuk menghindari circular dependency
    // Kita akan memanggil API endpoint internal atau menggunakan fungsi langsung
    const { getC300GponOnuDataViaSNMP, getC3xxOnuDataViaSNMP, getOnuDataViaSNMP } = await import('@/app/api/olts/onus/route')

    // Fetch ONU data dari SNMP
    let onuData: Array<{
      id: string
      oltId: string
      oltName: string
      name: string
      description: string
      pppoe: string
      gponOnu: string
      status: string
      rxOlt: string | null
      rxOnu: string | null
      txOlt: string | null
      txOnu: string | null
      serialNumber: string
      actualType: string
      registerTime: string | null
      distance: number | null
      lastSeen: string | null
      registrationMode: string | null
      softwareVersion: string | null
      hardwareVersion: string | null
      temperature: number | null
      laserBiasCurrent: number | null
    }> = []

    // Try C300 GPON parser first (standard ZTE GPON MIB)
    console.log(`[ONU-Sync] Trying C300 GPON parser (standard GPON MIB .1012)...`)
    onuData = await getC300GponOnuDataViaSNMP(
      olt.ipAddress,
      olt.snmpPort,
      olt.snmpCommunityWrite,
      olt.snmpVersion,
      olt.name,
      olt.id
    )
    
    // Jika C300 GPON parser tidak return data, coba C3XX parser
    if (onuData.length === 0) {
      console.log(`[ONU-Sync] C300 GPON parser returned no data, trying C3XX parser...`)
      onuData = await getC3xxOnuDataViaSNMP(
        olt.ipAddress,
        olt.snmpPort,
        olt.snmpCommunityWrite,
        olt.snmpVersion,
        olt.name,
        olt.id
      )
    }
    
    // Jika masih tidak ada data, coba parser standar (legacy)
    if (onuData.length === 0) {
      console.log(`[ONU-Sync] C3XX parser returned no data, trying standard parser...`)
      onuData = await getOnuDataViaSNMP(
        olt.ipAddress,
        olt.snmpPort,
        olt.snmpCommunityWrite,
        olt.snmpVersion,
        olt.name,
        olt.id
      )
    }

    console.log(`[ONU-Sync] Fetched ${onuData.length} ONUs from SNMP`)

    // Upsert data ke database
    let syncedCount = 0
    for (const onu of onuData) {
      try {
        await onuRepo.upsert(olt.id, onu.gponOnu, {
          oltId: olt.id,
          name: onu.name,
          description: onu.description || null,
          pppoe: onu.pppoe || null,
          gponOnu: onu.gponOnu,
          status: onu.status,
          rxOlt: onu.rxOlt,
          rxOnu: onu.rxOnu,
          txOlt: onu.txOlt || null,
          txOnu: onu.txOnu || null,
          serialNumber: onu.serialNumber || null,
          actualType: onu.actualType || null,
          registerTime: onu.registerTime ? new Date(onu.registerTime) : null,
          distance: onu.distance || null,
          lastSeen: onu.lastSeen ? new Date(onu.lastSeen) : null,
          registrationMode: onu.registrationMode || null,
          softwareVersion: onu.softwareVersion || null,
          hardwareVersion: onu.hardwareVersion || null,
          temperature: onu.temperature || null,
          laserBiasCurrent: onu.laserBiasCurrent || null,
        })
        syncedCount++
      } catch (error: any) {
        console.error(`[ONU-Sync] Error upserting ONU ${onu.gponOnu}:`, error?.message || error)
      }
    }

    // Update last sync time di OLT
    await prisma.olt.update({
      where: { id: olt.id },
      data: {
        onuLastSync: new Date(),
      },
    })

    console.log(`[ONU-Sync] Successfully synced ${syncedCount}/${onuData.length} ONUs for OLT ${olt.name}`)

    return syncedCount
  } catch (error: any) {
    console.error(`[ONU-Sync] Error syncing ONU data for OLT ${oltId}:`, error?.message || error)
    throw error
  }
}

/**
 * Sync data ONU dari semua OLT yang terhubung
 * @returns Total ONU yang berhasil di-sync
 */
export async function syncAllOnuData(): Promise<number> {
  const oltRepo = getOLTRepository()

  try {
    // Get all OLTs that have SNMP connected
    const olts = await oltRepo.findAll()
    const connectedOlts = olts.filter(
      (olt) => olt.snmpConnected && olt.snmpCommunityWrite && olt.onuSyncEnabled !== false
    )

    console.log(`[ONU-Sync] Starting sync for ${connectedOlts.length} OLTs...`)

    let totalSynced = 0
    for (const olt of connectedOlts) {
      try {
        const count = await syncOnuDataFromOlt(olt.id)
        totalSynced += count
      } catch (error: any) {
        console.error(`[ONU-Sync] Error syncing OLT ${olt.name}:`, error?.message || error)
      }
    }

    console.log(`[ONU-Sync] Completed sync for all OLTs. Total: ${totalSynced} ONUs synced`)
    return totalSynced
  } catch (error: any) {
    console.error(`[ONU-Sync] Error in syncAllOnuData:`, error?.message || error)
    throw error
  }
}

