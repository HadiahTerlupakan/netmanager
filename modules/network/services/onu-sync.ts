/**
 * Service untuk sync ONU data dari SNMP ke database
 * Digunakan oleh scheduler untuk polling data ONU secara berkala
 */

import { OLTRepository, OnuRepository } from '../repositories'
// NOTE: Fungsi getC300GponOnuDataViaSNMP dan countOnuFromSNMP tidak diimport dari route file
// karena akan menyebabkan error di production. Sebagai gantinya, sync dilakukan via optimized approach saja.
// Jika optimized approach gagal, kita skip legacy approach untuk menghindari error.
import { fetchOnuDataPaginated } from './snmp-optimized'
import { onuCacheService } from './onu-cache-service';

/**
 * Sync ONU data dari semua OLT yang terhubung via SNMP (Optimized Version)
 * @returns Jumlah total ONU yang berhasil di-sync
 */
export async function syncAllOnuData(): Promise<number> {
  const oltRepo = new OLTRepository()
  const onuRepo = new OnuRepository()

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

  // Sync ONU dari setiap OLT menggunakan optimized approach
  for (const olt of connectedOlts) {
    try {
      console.log(`[ONU-Sync] Syncing ONU data from OLT ${olt.name} (${olt.ipAddress}) using optimized approach...`)

      // Use optimized pagination approach for large datasets
      const pageSize = 100 // Process 100 ONUs at a time
      let page = 1
      let hasMoreData = true
      let totalOnuSynced = 0

      while (hasMoreData) {
        console.log(`[ONU-Sync] Processing page ${page} for OLT ${olt.name}...`)

        const result = await fetchOnuDataPaginated(
          olt.ipAddress,
          olt.snmpPort || 161,
          olt.snmpCommunityWrite || 'public',
          olt.snmpVersion || '2c',
          olt.id,
          page,
          pageSize
        )

        if (result.data.length === 0) {
          hasMoreData = false
          break
        }

        console.log(`[ONU-Sync] Processing ${result.data.length} ONUs from page ${page}...`)

        // Batch upsert untuk setiap halaman
        const upsertPromises = result.data.map(async (onu) => {
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
            return true
          } catch (error: any) {
            console.error(`[ONU-Sync] Error saving ONU ${onu.gponOnu}:`, error.message)
            return false
          }
        })

        const results = await Promise.allSettled(upsertPromises)
        const savedCount = results.filter(r => r.status === 'fulfilled' && r.value).length

        totalOnuSynced += savedCount
        totalSynced += savedCount

        console.log(`[ONU-Sync] Page ${page}: ${savedCount}/${result.data.length} ONUs saved successfully`)

        // Check if we have more data
        hasMoreData = result.pagination.page < result.pagination.totalPages
        page++

        // Add small delay to prevent overwhelming the OLT
        if (hasMoreData) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay between pages
        }
      }

      // Update OLT onuLastSync
      await oltRepo.update(olt.id, {
        onuLastSync: new Date(),
      })

      console.log(`[ONU-Sync] Successfully synced ${totalOnuSynced} ONUs for OLT ${olt.name}`)
    } catch (error: any) {
      // Log error dan lanjutkan ke OLT berikutnya
      // Legacy fallback dihapus karena fungsi getC300GponOnuDataViaSNMP tidak bisa diimport dari route file
      const errorMsg = `Error syncing OLT ${olt.name}: ${error.message}`
      console.error(`[ONU-Sync] ${errorMsg}`)
      errors.push(errorMsg)
    }
  }

  if (errors.length > 0) {
    console.warn(`[ONU-Sync] Completed with ${errors.length} errors:`, errors)
  }

  console.log(`[ONU-Sync] Total synced: ${totalSynced} ONUs from ${connectedOlts.length} OLTs`)

  // Clear cache setelah sync untuk memastikan data fresh
  if (totalSynced > 0) {
    onuCacheService.invalidateAllCaches()
    console.log(`[ONU-Sync] Cleared ONU cache after sync to ensure fresh data`)
  }

  return totalSynced
}

/**
 * Sync ONU data dari OLT tertentu dengan progress tracking
 * @param oltId - OLT ID
 * @param onProgress - Callback untuk update progress (percentage: number)
 * @returns Jumlah ONU yang berhasil di-sync
 */
export async function syncOnuDataByOltId(
  oltId: string,
  onProgress?: (percentage: number) => Promise<void>
): Promise<number> {
  const oltRepo = new OLTRepository()
  const onuRepo = new OnuRepository()

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

  // JANGAN hapus data ONU lama - gunakan upsert saja untuk menghindari jumlah data berubah-ubah
  const existingCount = await onuRepo.countByOltId(oltId)
  console.log(`[ONU-Sync] Found ${existingCount} existing ONUs for OLT ${olt.name} (will be updated/inserted via upsert)`)

  // Update progress: 0% (mulai)
  if (onProgress) {
    console.log(`[ONU-Sync] Calling onProgress(0) to set initial progress...`)
    await onProgress(0)
    console.log(`[ONU-Sync] onProgress(0) completed`)
  }

  // Gunakan fetchOnuDataPaginated untuk mengambil data ONU
  // Ini adalah pendekatan yang sama dengan syncAllOnuData
  const pageSize = 100
  let page = 1
  let hasMoreData = true
  let totalOnuSynced = 0
  let allOnuData: any[] = []

  console.log(`[ONU-Sync] Fetching ONU data using optimized paginated approach...`)

  // Update progress ke 5% sebelum mulai fetch
  if (onProgress) {
    await onProgress(5)
    console.log(`[ONU-Sync] Progress updated: 5% (Starting fetch)`)
  }

  while (hasMoreData) {
    console.log(`[ONU-Sync] Processing page ${page} for OLT ${olt.name}...`)

    const result = await fetchOnuDataPaginated(
      olt.ipAddress,
      olt.snmpPort || 161,
      olt.snmpCommunityWrite || 'public',
      olt.snmpVersion || '2c',
      olt.id,
      page,
      pageSize
    )

    if (result.data.length === 0) {
      hasMoreData = false
      break
    }

    console.log(`[ONU-Sync] Processing ${result.data.length} ONUs from page ${page}...`)
    allOnuData = allOnuData.concat(result.data)

    // Update progress: 5-30% selama fetch
    if (onProgress && result.pagination.totalPages > 0) {
      const fetchProgress = Math.min(30, 5 + Math.floor((page / result.pagination.totalPages) * 25))
      await onProgress(fetchProgress)
      console.log(`[ONU-Sync] Progress: ${fetchProgress}% (Fetching page ${page}/${result.pagination.totalPages})`)
    }

    // Check if we have more data
    hasMoreData = result.pagination.page < result.pagination.totalPages
    page++

    // Add small delay to prevent overwhelming the OLT
    if (hasMoreData) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  console.log(`[ONU-Sync] Fetched total ${allOnuData.length} ONUs from SNMP`)

  if (allOnuData.length === 0) {
    console.log(`[ONU-Sync] No ONU data found for OLT ${olt.name}`)
    if (onProgress) {
      await onProgress(100)
    }
    return 0
  }

  // Update progress: 30% setelah fetch selesai
  if (onProgress) {
    await onProgress(30)
    console.log(`[ONU-Sync] Progress: 30% (Fetch complete, starting save)`)
  }

  // Batch upsert untuk menyimpan data
  const batchSize = 50
  const totalBatches = Math.ceil(allOnuData.length / batchSize)
  let savedCount = 0

  for (let i = 0; i < allOnuData.length; i += batchSize) {
    const batch = allOnuData.slice(i, i + batchSize)
    const currentBatch = Math.floor(i / batchSize) + 1

    console.log(`[ONU-Sync] Saving batch ${currentBatch}/${totalBatches} (${batch.length} ONUs)...`)

    const upsertPromises = batch.map(async (onu) => {
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
        return true
      } catch (error: any) {
        console.error(`[ONU-Sync] Error saving ONU ${onu.gponOnu}:`, error.message)
        return false
      }
    })

    const results = await Promise.allSettled(upsertPromises)
    const batchSavedCount = results.filter(r => r.status === 'fulfilled' && r.value).length
    savedCount += batchSavedCount
    totalOnuSynced += batchSavedCount

    // Update progress: 30-95% selama save
    if (onProgress) {
      const saveProgress = Math.min(95, 30 + Math.floor(((i + batch.length) / allOnuData.length) * 65))
      await onProgress(saveProgress)
      console.log(`[ONU-Sync] Progress: ${saveProgress}% (Saved ${savedCount}/${allOnuData.length})`)
    }
  }

  // Update OLT onuLastSync
  await oltRepo.update(olt.id, {
    onuLastSync: new Date(),
  })

  // Update progress to 100%
  if (onProgress) {
    await onProgress(100)
    console.log(`[ONU-Sync] Progress: 100% (Complete)`)
  }

  console.log(`[ONU-Sync] Successfully synced ${savedCount}/${allOnuData.length} ONUs for OLT ${olt.name}`)

  // Clear cache setelah sync untuk memastikan data fresh
  if (savedCount > 0) {
    onuCacheService.invalidateAllCaches()
    console.log(`[ONU-Sync] Cleared ONU cache after sync to ensure fresh data`)
  }

  return savedCount
}

