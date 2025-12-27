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
  // Upsert sudah smart: hanya update field yang berubah, insert yang baru, skip yang sama
  // Ini mencegah masalah jumlah ONU yang berubah-ubah saat sync berjalan
  const existingCount = await onuRepo.countByOltId(oltId)
  console.log(`[ONU-Sync] Found ${existingCount} existing ONUs for OLT ${olt.name} (will be updated/inserted via upsert)`)

  // Update progress: 0% (mulai) - ini akan membuat total progress = 10% + 0% = 10%
  if (onProgress) {
    console.log(`[ONU-Sync] Calling onProgress(0) to set initial progress...`)
    await onProgress(0)
    console.log(`[ONU-Sync] onProgress(0) completed`)
  }

  // STEP 1: Hitung jumlah ONU terlebih dahulu (hanya ambil count, tidak ambil semua data)
  console.log(`[ONU-Sync] Step 1: Counting total ONUs from SNMP...`)
  let totalOnuCount = 0
  try {
    totalOnuCount = await countOnuFromSNMP(
      olt.ipAddress,
      olt.snmpPort,
      olt.snmpCommunityWrite,
      olt.snmpVersion
    )
    console.log(`[ONU-Sync] Found ${totalOnuCount} ONUs on OLT ${olt.name}`)

    // Update progress: 5% setelah menghitung jumlah ONU
    if (onProgress && totalOnuCount > 0) {
      await onProgress(5)
      console.log(`[ONU-Sync] Progress updated: 5% (ONU count: ${totalOnuCount})`)
    }
  } catch (error: any) {
    console.warn(`[ONU-Sync] Failed to count ONUs, will fetch all data: ${error.message}`)
    // Jika gagal menghitung, lanjutkan dengan fetch semua data
  }

  // STEP 2: Fetch semua data ONU dari SNMP secara bertahap
  console.log(`[ONU-Sync] Step 2: Fetching ONU data from SNMP...`)
  console.log(`[ONU-Sync] Expected ONU count from Step 1: ${totalOnuCount}`)

  // JANGAN gunakan maxResults untuk memastikan semua data terambil
  // Pass totalOnuCount sebagai expectedCount untuk validasi dan retry mechanism
  const onuData = await getC300GponOnuDataViaSNMP(
    olt.ipAddress,
    olt.snmpPort,
    olt.snmpCommunityWrite,
    olt.snmpVersion,
    olt.id,
    undefined, // maxResults - tidak digunakan
    totalOnuCount > 0 ? totalOnuCount : undefined // expectedCount dari Step 1
  )
  console.log(`[ONU-Sync] Fetched ${onuData.length} ONUs from SNMP`)

  // Bandingkan jumlah ONU yang di-count vs yang di-fetch
  if (totalOnuCount > 0 && onuData.length !== totalOnuCount) {
    console.warn(`[ONU-Sync] WARNING: Count mismatch! Expected ${totalOnuCount} ONUs but fetched ${onuData.length} ONUs`)
    console.warn(`[ONU-Sync] Using fetched count (${onuData.length}) for progress tracking as it's more accurate`)
  }

  // Gunakan onuData.length sebagai expectedCount karena lebih akurat (data yang benar-benar di-fetch)
  // Hanya gunakan totalOnuCount jika onuData.length adalah 0 (untuk kasus edge case)
  const expectedCount = onuData.length > 0 ? onuData.length : (totalOnuCount > 0 ? totalOnuCount : 0)

  if (onuData.length === 0) {
    console.log(`[ONU-Sync] No ONU data found for OLT ${olt.name}`)
    // Update progress: 100% (selesai, meskipun tidak ada data)
    if (onProgress) {
      console.log(`[ONU-Sync] No ONU data, calling onProgress(100)...`)
      await onProgress(100)
      console.log(`[ONU-Sync] onProgress(100) completed`)
    }
    return 0
  }

  console.log(`[ONU-Sync] Saving ${onuData.length} ONUs to database for OLT ${olt.name}...`)
  console.log(`[ONU-Sync] Expected total ONUs: ${expectedCount} (${expectedCount === onuData.length ? 'from fetched data' : totalOnuCount > 0 ? 'from count step' : 'estimated'})`)

  // Gunakan onuData.length sebagai actualTotal karena itu adalah data yang benar-benar di-fetch
  // Ini lebih akurat daripada count step yang mungkin tidak lengkap
  const actualTotal = onuData.length > 0 ? onuData.length : expectedCount

  // Update progress: 10% setelah fetch data selesai
  if (onProgress && actualTotal > 0) {
    await onProgress(10)
    console.log(`[ONU-Sync] Progress updated: 10% (Data fetched, starting to save...)`)
  }

  // Hitung batch size untuk progress tracking
  // Pastikan minimal 10 batch untuk progress yang lebih smooth
  // Jika ONU sedikit, bagi menjadi batch yang lebih kecil
  const minBatches = 10
  const totalBatches = actualTotal >= minBatches
    ? minBatches
    : Math.max(1, actualTotal) // Jika ONU < 10, gunakan jumlah ONU sebagai batch
  const batchSize = Math.max(1, Math.ceil(actualTotal / totalBatches))
  let savedCount = 0
  let currentBatch = 0
  let lastProgress = 10 // Track progress terakhir, mulai dari 10% (setelah fetch data)

  console.log(`[ONU-Sync] Processing ${actualTotal} ONUs in ${totalBatches} batches (batch size: ${batchSize})...`)

  // Process ONU dalam batch untuk memastikan setiap batch tersimpan dengan baik
  for (let batchStart = 0; batchStart < onuData.length; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, onuData.length)
    const batch = onuData.slice(batchStart, batchEnd)

    currentBatch++
    console.log(`[ONU-Sync] Processing batch ${currentBatch}/${totalBatches} (ONUs ${batchStart + 1}-${batchEnd} of ${onuData.length})...`)

    // Simpan semua ONU dalam batch ini dengan optimasi: hanya update yang berubah
    let batchSavedCount = 0
    let batchUpdatedCount = 0
    let batchSkippedCount = 0

    // Batch operations untuk performa lebih baik
    const upsertPromises = batch.map(async (onu) => {
      try {
        const result = await onuRepo.upsert(olt.id, onu.gponOnu, {
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
          lastSeen: onu.lastSeen || new Date(),
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
        return result
      } catch (error: any) {
        console.error(`[ONU-Sync] Error saving ONU ${onu.gponOnu}:`, error.message)
        return null
      }
    })

    // Wait for all upserts in batch to complete
    const results = await Promise.all(upsertPromises)

    for (const result of results) {
      if (result) {
        batchSavedCount++
        savedCount++
        if (result.updated) {
          batchUpdatedCount++
        } else {
          batchSkippedCount++
        }
      }
    }

    console.log(`[ONU-Sync] Batch ${currentBatch}/${totalBatches}: ${batchSavedCount} processed (${batchUpdatedCount} updated, ${batchSkippedCount} skipped - no changes)`)

    // Update progress setelah batch selesai
    if (onProgress && savedCount > 0) {
      // Progress dari 10% sampai 95% berdasarkan savedCount / actualTotal
      // Formula: 10 + (savedCount / actualTotal) * 85
      let currentProgress = actualTotal > 0
        ? Math.min(95, Math.floor(10 + (savedCount / actualTotal) * 85))
        : 95

      // Pastikan progress selalu naik, tidak turun
      if (currentProgress < lastProgress) {
        currentProgress = lastProgress
      }

      // Update progress jika ada perubahan
      if (currentProgress > lastProgress) {
        try {
          lastProgress = currentProgress
          await onProgress(currentProgress)
          console.log(`[ONU-Sync] Progress updated: ${currentProgress}% (${savedCount}/${actualTotal} ONUs processed)`)
          // Delay kecil untuk memastikan UI update
          await new Promise(resolve => setTimeout(resolve, 50))
        } catch (error: any) {
          console.error(`[ONU-Sync] Error updating progress:`, error.message)
        }
      }
    }

    // Setelah batch tersimpan dengan baik, update progress berdasarkan jumlah ONU yang sudah disimpan
    // Progress ONU sync: 10-95% (berdasarkan jumlah ONU yang sudah disimpan)
    // Gunakan actualTotal yang sudah didefinisikan di luar loop
    let progressPercentage = 0
    if (actualTotal > 0) {
      // Hitung progress berdasarkan jumlah ONU yang sudah disimpan
      // Range: 10% (setelah fetch) sampai 95% (sebelum final 100%)
      progressPercentage = Math.min(95, Math.floor(10 + (savedCount / actualTotal) * 85))

      // Pastikan progress minimal naik sesuai dengan batch number
      // Hitung total batch berdasarkan actualTotal, bukan expectedCount
      const actualTotalBatches = actualTotal >= minBatches
        ? minBatches
        : Math.max(1, actualTotal)
      const batchBasedProgress = Math.min(95, Math.floor(10 + (currentBatch / actualTotalBatches) * 85))
      progressPercentage = Math.max(progressPercentage, batchBasedProgress)
    } else {
      progressPercentage = 95
    }

    // Pastikan progress tidak turun (harus selalu naik)
    // Maksimal 95% sebelum final 100% (setelah semua proses benar-benar selesai)
    let finalProgress = Math.min(95, progressPercentage)

    // Pastikan progress selalu naik dari progress terakhir
    if (finalProgress < lastProgress) {
      finalProgress = lastProgress
    }

    if (onProgress && finalProgress > lastProgress) {
      console.log(`[ONU-Sync] Batch ${currentBatch}/${totalBatches} completed: ${batchSavedCount}/${batch.length} ONUs saved (Total: ${savedCount}/${actualTotal}). Calling onProgress(${finalProgress})...`)
      try {
        lastProgress = finalProgress
        // Pastikan progress di-update dengan await
        await onProgress(finalProgress)
        console.log(`[ONU-Sync] onProgress(${finalProgress}) completed successfully`)

        // Tambahkan delay kecil untuk memastikan progress terlihat dan database update selesai
        // Delay dikurangi untuk menghindari timeout, tapi tetap cukup untuk progress terlihat
        const delay = currentBatch < totalBatches ? 100 : 150 // 100ms untuk batch biasa, 150ms untuk batch terakhir
        await new Promise(resolve => setTimeout(resolve, delay))
      } catch (error: any) {
        console.error(`[ONU-Sync] Error calling onProgress(${finalProgress}):`, error.message)
        console.error(`[ONU-Sync] Error stack:`, error.stack)
      }
    } else {
      console.log(`[ONU-Sync] Batch ${currentBatch}/${totalBatches} completed: ${batchSavedCount}/${batch.length} ONUs saved. ONU Progress: ${finalProgress}% (Total saved: ${savedCount}/${actualTotal}) - ${onProgress ? 'Progress not increased' : 'No progress callback'}`)
    }
  }

  // Pastikan semua operasi database sudah commit dengan delay yang lebih lama
  // Delay ini memastikan bahwa semua write operations sudah benar-benar selesai
  console.log(`[ONU-Sync] Waiting for all database operations to complete...`)
  await new Promise(resolve => setTimeout(resolve, 2000)) // 2 detik delay untuk memastikan semua commit selesai

  // Verifikasi bahwa semua ONU benar-benar tersimpan sebelum update progress 100%
  // Retry verifikasi beberapa kali untuk memastikan database sudah commit
  console.log(`[ONU-Sync] Verifying all ONUs are saved in database...`)
  let actualSavedCount = 0
  let verificationAttempts = 0
  const maxVerificationAttempts = 10 // Increase retry attempts
  let verificationSuccess = false

  while (verificationAttempts < maxVerificationAttempts) {
    actualSavedCount = await onuRepo.countByOltId(olt.id)
    console.log(`[ONU-Sync] Verification attempt ${verificationAttempts + 1}/${maxVerificationAttempts}: ${actualSavedCount} ONUs found in database (expected: ${savedCount}, total data: ${onuData.length})`)

    // Jika count sudah sesuai atau mendekati (dalam toleransi 5%), anggap berhasil
    // Minimal harus ada data di database (tidak boleh 0)
    const minRequired = Math.max(1, Math.floor(onuData.length * 0.95))
    if (actualSavedCount >= minRequired && actualSavedCount > 0) {
      console.log(`[ONU-Sync] Verification successful: ${actualSavedCount} ONUs found in database (expected: ${savedCount}, required: ${minRequired})`)
      verificationSuccess = true
      break
    }

    // Jika belum sesuai, tunggu dan coba lagi
    verificationAttempts++
    if (verificationAttempts < maxVerificationAttempts) {
      const delay = verificationAttempts * 500 // Progressive delay: 500ms, 1000ms, 1500ms, etc.
      console.log(`[ONU-Sync] Verification incomplete (${actualSavedCount}/${minRequired}), waiting ${delay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    } else {
      console.warn(`[ONU-Sync] WARNING: Verification failed after ${maxVerificationAttempts} attempts. Found ${actualSavedCount} ONUs but expected at least ${minRequired}`)
      console.warn(`[ONU-Sync] This might indicate database commit delay or save operation failure.`)
    }
  }

  // Update OLT onuLastSync - pastikan ini benar-benar commit sebelum update progress
  console.log(`[ONU-Sync] Updating OLT onuLastSync...`)
  await oltRepo.update(olt.id, {
    onuLastSync: new Date(),
  })
  console.log(`[ONU-Sync] OLT onuLastSync updated successfully`)

  // Delay lagi untuk memastikan onuLastSync commit
  await new Promise(resolve => setTimeout(resolve, 500))

  // Update progress: 100% (selesai) - HANYA setelah verifikasi berhasil
  // Gunakan actualSavedCount dari database sebagai acuan utama, bukan savedCount dari counter
  // Karena actualSavedCount adalah data yang benar-benar ada di database
  const finalCount = actualSavedCount > 0 ? actualSavedCount : savedCount

  if (onProgress) {
    // Hanya update progress 100% jika verifikasi berhasil (ada data di database)
    if (verificationSuccess && actualSavedCount > 0) {
      console.log(`[ONU-Sync] ========================================`)
      console.log(`[ONU-Sync] VERIFICATION SUCCESSFUL - Updating progress to 100%`)
      console.log(`[ONU-Sync] ========================================`)
      console.log(`[ONU-Sync] Database verification: ${actualSavedCount} ONUs found in database`)
      console.log(`[ONU-Sync] Expected: ${onuData.length} ONUs, Attempted to save: ${savedCount} ONUs`)
      console.log(`[ONU-Sync] ========================================`)

      try {
        // Update progress ke 100% dengan delay tambahan untuk memastikan UI update
        await onProgress(100)
        console.log(`[ONU-Sync] Progress updated to 100% successfully`)

        // Delay lagi untuk memastikan progress update terlihat di frontend dan database commit
        await new Promise(resolve => setTimeout(resolve, 1000))
        console.log(`[ONU-Sync] All sync processes completed. Final count: ${actualSavedCount} ONUs in database`)
      } catch (error: any) {
        console.error(`[ONU-Sync] Error calling onProgress(100):`, error.message)
      }
    } else {
      // Jika verifikasi gagal (tidak ada data di database), update progress ke 95% (bukan 100%)
      // Ini menunjukkan bahwa proses belum benar-benar selesai
      console.warn(`[ONU-Sync] ========================================`)
      console.warn(`[ONU-Sync] VERIFICATION FAILED - Progress will NOT be 100%`)
      console.warn(`[ONU-Sync] ========================================`)
      console.warn(`[ONU-Sync] Only ${actualSavedCount} ONUs found in database`)
      console.warn(`[ONU-Sync] Expected: ${onuData.length} ONUs, Attempted to save: ${savedCount} ONUs`)
      console.warn(`[ONU-Sync] Progress will remain at 95% until data is verified in database`)
      console.warn(`[ONU-Sync] ========================================`)

      try {
        // Update progress ke 95% untuk menunjukkan masih ada proses final
        await onProgress(95)
        console.log(`[ONU-Sync] Progress updated to 95% (verification incomplete: ${actualSavedCount}/${onuData.length} ONUs in database)`)
        console.warn(`[ONU-Sync] WARNING: Progress is 95% because database verification failed.`)
        console.warn(`[ONU-Sync] Data may still be saving or there was an error during save operation.`)
      } catch (error: any) {
        console.error(`[ONU-Sync] Error calling onProgress(95):`, error.message)
      }
    }
  } else {
    console.log(`[ONU-Sync] All sync processes completed. Final count: ${actualSavedCount} ONUs in database (attempted to save: ${savedCount}, expected: ${onuData.length})`)
  }

  console.log(`[ONU-Sync] Successfully saved ${savedCount}/${onuData.length} ONUs for OLT ${olt.name}`)

  // STEP 3: Cleanup ONU yang sudah tidak ada di SNMP lagi (OPTIONAL - HATI-HATI!)
  // PENTING: JANGAN hapus data jika fetch tidak lengkap atau ada error
  // Hanya lakukan cleanup jika:
  // 1. Sync berhasil (savedCount > 0)
  // 2. Data yang di-fetch lengkap (onuData.length >= expectedCount atau minimal 80% dari existing)
  // 3. Tidak ada error selama sync
  // 4. JANGAN cleanup jika onuData.length === 0 (fetch gagal)
  // Ini mencegah data hilang jika SNMP fetch gagal atau tidak lengkap
  const existingCountBeforeSync = existingCount

  // Validasi ketat untuk mencegah penghapusan data yang tidak seharusnya
  // JANGAN cleanup jika:
  // - Tidak ada data yang di-fetch (fetch gagal)
  // - Data yang di-fetch terlalu sedikit dibanding existing (fetch tidak lengkap)
  // - Tidak ada data yang berhasil di-save
  const minDataRequired = existingCountBeforeSync > 0
    ? Math.max(1, Math.floor(existingCountBeforeSync * 0.8)) // Minimal 80% dari existing
    : 1 // Jika tidak ada existing, minimal 1 data

  const shouldCleanup = savedCount > 0 &&
    onuData.length > 0 &&
    onuData.length >= minDataRequired &&
    existingCountBeforeSync > 0 // Hanya cleanup jika sebelumnya ada data

  if (shouldCleanup) {
    try {
      console.log(`[ONU-Sync] Cleanup phase: Checking for ONUs that no longer exist in SNMP...`)
      console.log(`[ONU-Sync] Existing before sync: ${existingCountBeforeSync}, Fetched: ${onuData.length}, Saved: ${savedCount}`)

      // Ambil semua gponOnu yang baru saja di-sync dari SNMP
      const syncedGponOnus = new Set(onuData.map(onu => onu.gponOnu))

      // Ambil semua ONU dari database untuk OLT ini
      const allDbOnus = await onuRepo.findByOltId(olt.id)

      // Cari ONU yang ada di database tapi tidak ada di SNMP (sudah dicabut/dihapus dari OLT)
      const onusToDelete = allDbOnus.filter(dbOnu => !syncedGponOnus.has(dbOnu.gponOnu))

      if (onusToDelete.length > 0) {
        // HANYA hapus jika jumlah yang akan dihapus tidak terlalu banyak (max 10% dari total)
        // Ini mencegah penghapusan massal jika ada masalah dengan fetch
        const maxDeleteAllowed = Math.max(1, Math.floor(allDbOnus.length * 0.1))

        if (onusToDelete.length <= maxDeleteAllowed) {
          console.log(`[ONU-Sync] Found ${onusToDelete.length} ONUs that no longer exist in SNMP (will be deleted, within safe limit: ${maxDeleteAllowed})...`)

          // Hapus ONU yang sudah tidak ada di SNMP (cleanup)
          // Ini dilakukan SETELAH semua upsert selesai, sehingga tidak mengganggu jumlah data
          for (const onuToDelete of onusToDelete) {
            try {
              await onuRepo.delete(onuToDelete.id)
            } catch (error: any) {
              console.error(`[ONU-Sync] Error deleting ONU ${onuToDelete.gponOnu}:`, error.message)
            }
          }

          console.log(`[ONU-Sync] Cleanup completed: Deleted ${onusToDelete.length} ONUs that no longer exist in SNMP`)
        } else {
          console.warn(`[ONU-Sync] SKIPPING cleanup: Too many ONUs to delete (${onusToDelete.length} > ${maxDeleteAllowed})`)
          console.warn(`[ONU-Sync] This might indicate a problem with SNMP fetch. Data will NOT be deleted to prevent data loss.`)
        }
      } else {
        console.log(`[ONU-Sync] No cleanup needed - all database ONUs still exist in SNMP`)
      }
    } catch (error: any) {
      console.error(`[ONU-Sync] Error during cleanup phase:`, error.message)
      // Jangan throw error - cleanup bukan critical, lanjutkan saja
    }
  } else {
    console.log(`[ONU-Sync] SKIPPING cleanup: Conditions not met (savedCount: ${savedCount}, onuData.length: ${onuData.length}, existing: ${existingCountBeforeSync})`)
    console.log(`[ONU-Sync] This prevents data loss if SNMP fetch failed or incomplete`)
  }

  // Clear cache setelah sync untuk memastikan data fresh
  if (savedCount > 0) {
    onuCacheService.invalidateAllCaches()
    console.log(`[ONU-Sync] Cleared ONU cache after sync to ensure fresh data`)
  }

  return savedCount
}

