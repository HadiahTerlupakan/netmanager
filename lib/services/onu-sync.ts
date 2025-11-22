/**
 * Service untuk sync ONU data dari SNMP ke database
 * Digunakan oleh scheduler untuk polling data ONU secara berkala
 */

import { getOLTRepository, getOnuRepository } from '@/lib/repositories'
import { getC300GponOnuDataViaSNMP, countOnuFromSNMP } from '@/app/api/onus/sync/route'
import { fetchOnuDataPaginated } from '@/lib/services/snmp-optimized'

/**
 * Sync ONU data dari semua OLT yang terhubung via SNMP (Optimized Version)
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
      console.error(`[ONU-Sync] Error with optimized approach for OLT ${olt.name}, falling back to legacy:`, error.message)

      // Fallback to legacy approach if optimized fails
      try {
        const onuData = await getC300GponOnuDataViaSNMP(
          olt.ipAddress,
          olt.snmpPort,
          olt.snmpCommunityWrite,
          olt.snmpVersion,
          olt.id
        )

        if (onuData.length === 0) {
          console.log(`[ONU-Sync] No ONU data found for OLT ${olt.name} (legacy fallback)`)
          continue
        }

        console.log(`[ONU-Sync] Legacy fallback: Processing ${onuData.length} ONUs for OLT ${olt.name}...`)

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

        totalSynced += savedCount
        console.log(`[ONU-Sync] Legacy fallback: Successfully saved ${savedCount}/${onuData.length} ONUs for OLT ${olt.name}`)
      } catch (fallbackError: any) {
        const errorMsg = `Error syncing OLT ${olt.name} (both optimized and legacy failed): ${fallbackError.message}`
        console.error(`[ONU-Sync] ${errorMsg}`)
        errors.push(errorMsg)
      }
    }
  }

  if (errors.length > 0) {
    console.warn(`[ONU-Sync] Completed with ${errors.length} errors:`, errors)
  }

  console.log(`[ONU-Sync] Total synced: ${totalSynced} ONUs from ${connectedOlts.length} OLTs`)
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

  // STEP 0: Hapus data ONU lama sebelum sync dimulai
  console.log(`[ONU-Sync] Step 0: Deleting existing ONU data for OLT ${olt.name}...`)
  try {
    // Hitung jumlah ONU yang akan dihapus
    const existingCount = await onuRepo.countByOltId(oltId)
    if (existingCount > 0) {
      await onuRepo.deleteByOltId(oltId)
      console.log(`[ONU-Sync] Deleted ${existingCount} existing ONUs for OLT ${olt.name}`)
    } else {
      console.log(`[ONU-Sync] No existing ONU data to delete for OLT ${olt.name}`)
    }
  } catch (error: any) {
    console.error(`[ONU-Sync] Error deleting existing ONU data:`, error.message)
    // Lanjutkan sync meskipun delete gagal (mungkin tidak ada data lama)
  }

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

    // Simpan semua ONU dalam batch ini dengan semua field
    let batchSavedCount = 0
    for (const onu of batch) {
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
        })
        batchSavedCount++
        savedCount++
        
        // Update progress setiap beberapa ONU untuk progress yang lebih smooth dan terlihat
        // Progress dihitung dari 10% (setelah fetch) sampai 95% (sebelum final 100%)
        // Jadi range progress untuk saving: 10% - 95% = 85% range
        // Update lebih sering untuk progress yang lebih terlihat, tapi tidak terlalu sering untuk menghindari timeout
        const updateInterval = Math.max(2, Math.min(5, Math.ceil(actualTotal / 30))) // Update setiap 2-5 ONU
        if (savedCount % updateInterval === 0 || savedCount === onuData.length) {
          // Progress dari 10% sampai 95% berdasarkan savedCount / actualTotal
          // Formula: 10 + (savedCount / actualTotal) * 85
          let currentProgress = actualTotal > 0 
            ? Math.min(95, Math.floor(10 + (savedCount / actualTotal) * 85))
            : 95
          
          // Pastikan progress selalu naik, tidak turun
          if (currentProgress < lastProgress) {
            currentProgress = lastProgress
          }
          
          // Update progress jika ada perubahan (tidak perlu batasi dengan expectedCount karena bisa ada lebih banyak ONU)
          if (onProgress && currentProgress > lastProgress) {
            try {
              lastProgress = currentProgress
              await onProgress(currentProgress)
              console.log(`[ONU-Sync] Progress updated: ${currentProgress}% (${savedCount}/${actualTotal} ONUs saved)`)
              // Delay kecil untuk memastikan UI update
              await new Promise(resolve => setTimeout(resolve, 50))
            } catch (error: any) {
              console.error(`[ONU-Sync] Error updating progress:`, error.message)
            }
          }
        }
      } catch (error: any) {
        console.error(`[ONU-Sync] Error saving ONU ${onu.gponOnu}:`, error.message)
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
  return savedCount
}

