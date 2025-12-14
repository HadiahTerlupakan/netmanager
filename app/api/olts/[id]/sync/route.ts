import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository, getOnuRepository } from '@/lib/repositories'
import { syncOnuDataByOltId } from '@/lib/services/onu-sync'
import snmp from 'net-snmp'
import '@/lib/utils/event-emitter-config'

// Set max duration untuk sync yang memakan waktu lama (10 menit)
export const maxDuration = 600 // 10 menit dalam detik
export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

// SNMP OIDs untuk ZTE-C300 dan umum
const SNMP_OIDS = {
  sysDescr: '1.3.6.1.2.1.1.1.0', // System description (version info)
  sysUpTime: '1.3.6.1.2.1.1.3.0', // System uptime
  sysName: '1.3.6.1.2.1.1.5.0', // System name
  temperature: '1.3.6.1.4.1.3902.1015.2.1.3.2.0', // ZTE C300-B temperature (dari Zabbix template)
  connectedDevices: '1.3.6.1.2.1.2.1.0', // Number of interfaces (proxy untuk connected devices)
}

async function getSNMPValue(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string
): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false
    let session: any = null
    let timeoutId: NodeJS.Timeout | null = null

    const finish = (value: string | null) => {
      if (resolved) return
      resolved = true
      if (timeoutId) clearTimeout(timeoutId)
      if (session) {
        try {
          session.close()
        } catch (e) {
          // Ignore close errors (session might already be closed)
        }
      }
      resolve(value)
    }

    try {
      let snmpVersion: 0 | 1 | undefined = 1 // Default: Version2c
      if (version === '1') {
        snmpVersion = 0 // Version1
      } else if (version === '3') {
        // SNMP v3 tidak didukung oleh net-snmp library yang digunakan
        console.warn(`[SNMP] SNMP v3 is not supported, using v2c instead`)
        snmpVersion = 1 // Fallback to Version2c
      }

      session = snmp.createSession(ipAddress, community, {
        port,
        version: snmpVersion,
        retries: 2,
        timeout: 5000,
      })
      
      // Set max listeners untuk menghindari warning
      if (session && session.setMaxListeners) {
        session.setMaxListeners(20)
      }

      session.get([oid], (error: any, varbinds: any[]) => {
        if (resolved) return

        if (error || !varbinds || varbinds.length === 0) {
          finish(null)
        } else {
          const varbind = varbinds[0]
          if (varbind.value !== null && varbind.value !== undefined) {
            finish(varbind.value.toString())
          } else {
            finish(null)
          }
        }
      })

      timeoutId = setTimeout(() => {
        finish(null)
      }, 10000)
    } catch (error) {
      finish(null)
    }
  })
}

function formatUptime(centiseconds: number | null): string | null {
  if (!centiseconds) return null

  const seconds = Math.floor(centiseconds / 100)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (days > 0) {
    return `${days} days ${hours} hours ${minutes} minutes`
  } else if (hours > 0) {
    return `${hours} hours ${minutes} minutes`
  } else if (minutes > 0) {
    return `${minutes} minutes ${secs} seconds`
  } else {
    return `${secs} seconds`
  }
}

// Background sync function - tidak blocking
async function runSyncInBackground(oltId: string) {
  console.log(`[OLT-Sync-BG] Starting background sync for OLT ${oltId}...`)
  const oltRepository = getOLTRepository()
  
  try {
    const olt = await oltRepository.findById(oltId)

    if (!olt) {
      console.error(`[OLT-Sync-BG] OLT ${oltId} not found`)
      await oltRepository.update(oltId, {
        syncStatus: '0',
      })
      return
    }

    if (!olt.snmpConnected) {
      console.error(`[OLT-Sync-BG] OLT ${olt.name} SNMP not connected`)
      await oltRepository.update(oltId, {
        syncStatus: '0',
      })
      return
    }
    // Get data dari SNMP
    const [version, uptimeStr, model, devicesStr, tempStr] = await Promise.all([
      getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.sysDescr),
      getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.sysUpTime),
      getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.sysName),
      getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.connectedDevices),
      getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.temperature),
    ])

    // Parse data
    const uptime = uptimeStr ? formatUptime(parseInt(uptimeStr)) : null
    const temperature = tempStr ? parseInt(tempStr) : null
    const connectedDevices = devicesStr ? parseInt(devicesStr) : null

    // Cek syncStatus saat ini - jika sudah 100%, saat sync ulang tidak reset ke 0%
    // Progress akan tetap di 100% sampai sync baru dimulai, lalu mulai dari 10%
    const currentSyncStatus = olt.syncStatus ? parseInt(olt.syncStatus, 10) : 0
    
    // Jika sync sudah 100%, saat sync ulang tetap mulai dari 10% (tidak reset ke 0%)
    // Progress akan naik dari 10% ke 100% lagi
    const startProgress = '10' // Mulai dari 10% saat sync baru dimulai

    // Update OLT dengan data yang didapat (sync OLT data - 10% progress)
    const updateData: any = {
      syncStatus: startProgress, // Mulai dengan 10% setelah sync OLT data
      syncDate: new Date(),
    }

    if (version) updateData.version = version.substring(0, 200) // Limit length
    if (uptime) updateData.uptime = uptime
    if (temperature !== null && !isNaN(temperature)) updateData.temperature = temperature
    if (connectedDevices !== null && !isNaN(connectedDevices) && connectedDevices >= 0) {
      updateData.connectedDevices = connectedDevices
    }
    if (model) updateData.model = model

    await oltRepository.update(oltId, updateData)
    console.log(`[OLT-Sync-BG] OLT data synced, progress: 10%`)

    // Setelah sync OLT berhasil, sync semua ONU dari OLT ini dengan progress tracking
    let onuSyncResult: { success: boolean; count?: number; error?: string } | null = null
    try {
      // Cek apakah OLT adalah C300 dan SNMP connected (required untuk sync ONU)
      if (olt.type?.toLowerCase().includes('c300') && olt.snmpConnected && olt.snmpCommunityWrite) {
        console.log(`[OLT-Sync-BG] Starting ONU sync for OLT ${olt.name} (${olt.ipAddress})...`)
        
        // Progress callback untuk update syncStatus secara bertahap
        // Progress ini akan di-baca oleh frontend dari syncStatus di database
        const onProgress = async (percentage: number) => {
          try {
            // Progress ONU sync: 0-95% (saving ONUs), kemudian 100% setelah semua proses selesai dan terverifikasi
            // Total progress = 10% (OLT) + progress ONU (0-95% atau 100%)
            // Formula untuk memastikan frontend tidak melihat 100% sebelum proses benar-benar selesai:
            //   - Jika percentage < 100: totalProgress = 10 + (percentage / 95) * 89 = 10% sampai 99%
            //   - Jika percentage = 100: totalProgress = 100 (hanya setelah verifikasi berhasil)
            // Contoh: percentage=0->10%, percentage=50->56%, percentage=90->94%, percentage=95->99%, percentage=100->100%
            let totalProgress: number
            if (percentage >= 100) {
              // Progress 100% hanya setelah verifikasi berhasil
              totalProgress = 100
            } else {
            // Progress maksimal 99% sebelum final 100%
            // Range: 10% (OLT) sampai 99% (sebelum final)
            // Formula: 10 + (percentage / 95) * 89 = 10% sampai 99%
            // Contoh: percentage=90 -> 10+(90/95)*89=94%, percentage=95 -> 10+(95/95)*89=99%
            totalProgress = Math.min(99, 10 + Math.floor((percentage / 95) * 89))
            }
            
            console.log(`[OLT-Sync-BG] Updating progress: ${totalProgress}% (ONU sync: ${percentage}%)`)
            await oltRepository.update(oltId, {
              syncStatus: totalProgress.toString(),
            })
            console.log(`[OLT-Sync-BG] Progress updated successfully: ${totalProgress}% (ONU sync: ${percentage}%)`)
          } catch (error: any) {
            console.error(`[OLT-Sync-BG] Error updating progress:`, error.message)
            // Jangan throw error, biarkan sync tetap berjalan
          }
        }
        
        const onuCount = await syncOnuDataByOltId(oltId, onProgress)
        
        // Verifikasi final: pastikan data benar-benar tersimpan di database sebelum set result
        // Progress 100% sudah di-update di dalam syncOnuDataByOltId setelah verifikasi berhasil
        // Tapi kita perlu verifikasi sekali lagi di sini untuk memastikan
        console.log(`[OLT-Sync-BG] Final verification: checking ONU data in database...`)
        const onuRepo = getOnuRepository()
        const finalOnuCount = await onuRepo.countByOltId(oltId)
        console.log(`[OLT-Sync-BG] Final verification: ${finalOnuCount} ONUs found in database (expected: ${onuCount})`)
        
        // Pastikan semua proses benar-benar selesai sebelum set result
        // Delay untuk memastikan semua database operations sudah commit
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Update progress 100% hanya jika verifikasi berhasil
        // Progress 100% mungkin sudah di-update di syncOnuDataByOltId, tapi kita pastikan sekali lagi
        if (finalOnuCount > 0 && finalOnuCount >= onuCount * 0.95) {
          // Cek progress saat ini untuk menghindari double update
          const currentOlt = await oltRepository.findById(oltId)
          const currentProgress = currentOlt?.syncStatus ? parseInt(currentOlt.syncStatus, 10) : 0
          
          if (currentProgress < 100) {
            console.log(`[OLT-Sync-BG] Final verification successful, updating progress to 100%...`)
            await oltRepository.update(oltId, {
              syncStatus: '100',
            })
            console.log(`[OLT-Sync-BG] Progress updated to 100% after final verification`)
          } else {
            console.log(`[OLT-Sync-BG] Final verification successful, progress already at 100%`)
          }
        } else {
          console.warn(`[OLT-Sync-BG] WARNING: Final verification incomplete (${finalOnuCount}/${onuCount} ONUs). Progress will remain at 99%`)
          // Progress tetap di 99% jika verifikasi gagal
          await oltRepository.update(oltId, {
            syncStatus: '99',
          })
        }
        
        onuSyncResult = {
          success: true,
          count: onuCount,
        }
        console.log(`[OLT-Sync-BG] ONU sync completed: ${onuCount} ONUs synced, ${finalOnuCount} ONUs verified in database`)
      } else {
        console.log(`[OLT-Sync-BG] Skipping ONU sync: OLT is not C300 or SNMP not connected`)
        // Jika tidak sync ONU, langsung set ke 100%
        await oltRepository.update(oltId, {
          syncStatus: '100',
        })
        onuSyncResult = {
          success: false,
          error: 'OLT is not C300 or SNMP not connected',
        }
      }
    } catch (onuSyncError: any) {
      console.error(`[OLT-Sync-BG] ONU sync failed:`, onuSyncError.message)
      // Set progress ke 100% meskipun ada error (OLT data sudah tersimpan)
      await oltRepository.update(oltId, {
        syncStatus: '100',
      })
      onuSyncResult = {
        success: false,
        error: onuSyncError.message || 'Gagal sync ONU data',
      }
      // Jangan fail request jika sync ONU gagal, karena sync OLT sudah berhasil
    }

    console.log(`[OLT-Sync-BG] Background sync completed for OLT ${olt.name}`)
  } catch (error: any) {
    console.error(`[OLT-Sync-BG] Background sync error:`, error)
    console.error(`[OLT-Sync-BG] Error stack:`, error.stack)
    // Update status ke error jika perlu
    try {
      const oltRepository = getOLTRepository()
      await oltRepository.update(oltId, {
        syncStatus: '0',
      })
      console.log(`[OLT-Sync-BG] Progress updated to 0% (error occurred)`)
    } catch (updateError: any) {
      console.error(`[OLT-Sync-BG] Failed to update error status:`, updateError.message)
    }
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
    const { provider } = await params
  const oltRepository = getOLTRepository()
  const olt = await oltRepository.findById(id)

  if (!olt) {
    return NextResponse.json({ error: 'OLT tidak ditemukan' }, { status: 404 })
  }

      const { id } = await params
    const { provider } = await params
if (!olt.snmpConnected) {
    return NextResponse.json({ error: 'SNMP tidak connected. Silakan test connection terlebih dahulu.' }, { status: 400 })
  }

  // Update progress ke 1% segera untuk menunjukkan sync sudah dimulai
  // Ini dilakukan sebelum background process untuk memastikan user melihat progress
  try {
    await oltRepository.update(id, {
      syncStatus: '1',
    })
    console.log(`[OLT-Sync] Progress updated to 1% (sync starting)`)
  } catch (updateError: any) {
    console.error(`[OLT-Sync] Failed to update initial progress:`, updateError.message)
    // Continue anyway
  }

  // Jalankan sync di background (non-blocking)
  // Gunakan setTimeout dengan delay 0 untuk memastikan response dikirim dulu
  // Ini memastikan background process berjalan setelah response dikirim
  setTimeout(() => {
    console.log(`[OLT-Sync] Starting background sync for OLT ${id}...`)
    runSyncInBackground(id)
      .then(() => {
        console.log(`[OLT-Sync] Background sync completed successfully for OLT ${id}`)
      })
      .catch((error) => {
        console.error(`[OLT-Sync] Background sync error for OLT ${id}:`, error)
        console.error(`[OLT-Sync] Error stack:`, error.stack)
      })
  }, 0)

  // Langsung return response tanpa menunggu sync selesai
  return NextResponse.json({
    success: true,
    message: 'Sync dimulai di background. Progress dapat dilihat di kolom Synchronization Status.',
    oltId: id,
    oltName: olt.name,
  })
}

