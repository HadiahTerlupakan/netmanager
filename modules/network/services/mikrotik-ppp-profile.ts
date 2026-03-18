import { RadiusConnectionError } from '../errors';
/**
 * Service untuk mengelola Profile PPP di MikroTik Router
 */

import { RouterOSAPI } from 'node-routeros-v2'
import { prisma } from '@/lib/prisma'

interface MikroTikRouterConfig {
  ipAddress: string
  apiPort: number
  apiUsername: string
  apiPassword: string
}

interface PPPProfileData {
  name: string
  localAddress: string
  remoteAddress: string // Nama IP Pool (harus dibuat terlebih dahulu)
  ipRange?: string | null // Range IP untuk pool (contoh: "192.168.1.100-192.168.1.200")
  dnsServer?: string | null
  sessionTimeout?: number | null
  idleTimeout?: number | null
  rateLimit?: string // Format: "10M/10M" (download/upload)
}

/**
 * Membuat koneksi ke MikroTik Router
 */
async function connectToMikroTik(config: MikroTikRouterConfig, timeout: number = 5000): Promise<RouterOSAPI> {
  const conn = new RouterOSAPI({
    host: config.ipAddress,
    user: config.apiUsername,
    password: config.apiPassword,
    port: config.apiPort,
    timeout: timeout,
  })

  await conn.connect()
  return conn
}

/**
 * Cek apakah IP Pool sudah ada di MikroTik
 */
async function checkIPPoolExists(conn: RouterOSAPI, poolName: string): Promise<boolean> {
  try {
    const pools = await conn.write('/ip/pool/print', ['?name=' + poolName])
    return pools && pools.length > 0
  } catch (error) {
    console.error('[MikroTik IP Pool] Error checking pool:', error)
    throw new RadiusConnectionError("Gagal terhubung ke router: " + (error instanceof Error ? error.message : String(error)))
  }
}

/**
 * Format rate limit dari Bandwidth sesuai dokumentasi MikroTik
 * Format: rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate] [rx-burst-threshold[/tx-burst-threshold] [rx-burst-time[/tx-burst-time] [priority] [rx-rate-min[/tx-rate-min]]]]
 * 
 * Dari sudut pandang router:
 * - rx-rate = client upload = download dari client = maxLimitDownload
 * - tx-rate = client download = upload dari client = maxLimitUpload
 * 
 * @param bandwidth Data Bandwidth
 * @returns Rate limit dalam format MikroTik
 */
function formatRateLimitFromBandwidth(bandwidth: {
  maxLimitDownload: string;
  maxLimitUpload: string;
  burstLimitDownload?: string | null;
  burstLimitUpload?: string | null;
  burstThresholdDownload?: string | null;
  burstThresholdUpload?: string | null;
  burstTimeDownload?: number | null;
  burstTimeUpload?: number | null;
  priority?: number | null;
  minLimitDownload?: string | null;
  minLimitUpload?: string | null;
}): string {
    // Format rate limit sesuai dokumentasi MikroTik:
    // rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate] [rx-burst-threshold[/tx-burst-threshold] [rx-burst-time[/tx-burst-time] [priority] [rx-rate-min[/tx-rate-min]]]]
    // rx-rate = maxLimitDownload (client upload dari sudut pandang router)
    // tx-rate = maxLimitUpload (client download dari sudut pandang router)
    
    let rateLimit = `${bandwidth.maxLimitDownload}/${bandwidth.maxLimitUpload}`

    // Tambahkan burst-rate jika ada
    if (bandwidth.burstLimitDownload || bandwidth.burstLimitUpload) {
      const burstRx = bandwidth.burstLimitDownload || bandwidth.maxLimitDownload
      const burstTx = bandwidth.burstLimitUpload || bandwidth.maxLimitUpload
      rateLimit += ` ${burstRx}/${burstTx}`
    }

    // Tambahkan burst-threshold jika ada
    if (bandwidth.burstThresholdDownload || bandwidth.burstThresholdUpload) {
      const thresholdRx = bandwidth.burstThresholdDownload || bandwidth.maxLimitDownload
      const thresholdTx = bandwidth.burstThresholdUpload || bandwidth.maxLimitUpload
      rateLimit += ` ${thresholdRx}/${thresholdTx}`
    }

    // Tambahkan burst-time jika ada
    if (bandwidth.burstTimeDownload || bandwidth.burstTimeUpload) {
      const timeRx = bandwidth.burstTimeDownload || 1
      const timeTx = bandwidth.burstTimeUpload || bandwidth.burstTimeDownload || 1
      rateLimit += ` ${timeRx}/${timeTx}`
    }

    // Tambahkan priority jika ada
    if (bandwidth.priority) {
      rateLimit += ` ${bandwidth.priority}`
    }

    // Tambahkan rate-min jika ada
    if (bandwidth.minLimitDownload || bandwidth.minLimitUpload) {
      const minRx = bandwidth.minLimitDownload || bandwidth.maxLimitDownload
      const minTx = bandwidth.minLimitUpload || bandwidth.maxLimitUpload
      rateLimit += ` ${minRx}/${minTx}`
    }
    
    return rateLimit
}

/**
 * Ambil rate limit dari Bandwidth yang terkait dengan Profile PPP
 * Prioritas: 1. bandwidthId langsung (jika disediakan), 2. HargaPaket yang terkait
 * Format sesuai dokumentasi MikroTik:
 * rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate] [rx-burst-threshold[/tx-burst-threshold] [rx-burst-time[/tx-burst-time] [priority] [rx-rate-min[/tx-rate-min]]]]
 * 
 * @param profilePPPId ID Profile PPP
 * @param bandwidthId ID Bandwidth (opsional, jika disediakan akan digunakan langsung)
 * @returns Rate limit dalam format MikroTik atau null jika tidak ditemukan
 */
export async function getRateLimitFromBandwidth(
  profilePPPId: string,
  bandwidthId?: string | null
): Promise<string | null> {
  try {
    // Jika bandwidthId disediakan, ambil langsung dari Bandwidth
    if (bandwidthId) {
      const bandwidth = await prisma.bandwidth.findUnique({
        where: { id: bandwidthId },
      })

      if (!bandwidth) {
        // console.log('[MikroTik PPP] Bandwidth not found:', bandwidthId)
        return null
      }

      const rateLimit = formatRateLimitFromBandwidth(bandwidth)
      // console.log('[MikroTik PPP] Rate limit from Bandwidth (direct):', rateLimit)
      return rateLimit
    }

    // Jika tidak ada bandwidthId, ambil dari HargaPaket yang terkait
    const profilePPP = await prisma.profilePPP.findUnique({
      where: { id: profilePPPId },
      include: {
        hargaPaket: {
          include: {
            bandwidth: true,
          },
        },
      },
    })

    if (!profilePPP || !profilePPP.hargaPaket || profilePPP.hargaPaket.length === 0) {
      // console.log('[MikroTik PPP] No HargaPaket found for Profile PPP:', profilePPPId)
      return null
    }

    // Ambil Bandwidth dari HargaPaket pertama (bisa diubah untuk mengambil yang aktif atau prioritas tertentu)
    const hargaPaket = profilePPP.hargaPaket.find(hp => hp.status === 'AKTIF') || profilePPP.hargaPaket[0]
    
    if (!hargaPaket || !hargaPaket.bandwidth) {
      // console.log('[MikroTik PPP] No Bandwidth found for HargaPaket')
      return null
    }

    const bandwidth = hargaPaket.bandwidth

    const rateLimit = formatRateLimitFromBandwidth(bandwidth)
    // console.log('[MikroTik PPP] Rate limit from Bandwidth (via HargaPaket):', rateLimit)
    return rateLimit
  } catch (error) {
    console.error('[MikroTik PPP] Error getting rate limit from bandwidth:', error)
    throw new RadiusConnectionError("Gagal terhubung ke router: " + (error instanceof Error ? error.message : String(error)))
  }
}

/**
 * Ambil IP Pool ranges dari MikroTik
 * @param routerId ID router MikroTik
 * @param poolName Nama IP Pool
 * @returns IP ranges dalam format "start-end" atau null jika tidak ditemukan
 */
export async function getIPPoolRanges(
  routerId: string,
  poolName: string
): Promise<{ success: boolean; ranges?: string; error?: string }> {
  try {
    // Ambil data router dari database
    const router = await prisma.mikroTikRouter.findUnique({
      where: { id: routerId },
    })

    if (!router) {
      return { success: false, error: 'Router tidak ditemukan' }
    }

    const conn = await connectToMikroTik({
      ipAddress: router.ipAddress,
      apiPort: router.apiPort,
      apiUsername: router.apiUsernameGenerated || router.apiUsername,
      apiPassword: router.apiPasswordGenerated || router.apiPassword,
    })

    try {
      // Ambil IP Pool dari MikroTik
      const pools = await conn.write('/ip/pool/print', ['?name=' + poolName])
      
      if (!pools || pools.length === 0 || !pools[0]) {
        conn.close()
        return { success: false, error: 'IP Pool tidak ditemukan' }
      }

      const pool = pools[0]
      const ranges = pool['ranges'] || null

      conn.close()
      
      if (!ranges || ranges.trim() === '') {
        return { success: false, error: 'IP Pool tidak memiliki ranges' }
      }

      return { success: true, ranges: ranges }
    } catch (error) {
      conn.close()
      console.error('[MikroTik IP Pool] Error getting pool ranges:', error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage || 'Gagal mengambil IP Pool ranges dari MikroTik' }
    }
  } catch (error) {
    console.error('[MikroTik IP Pool] Error connecting to MikroTik:', error)
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage || 'Gagal terhubung ke MikroTik Router' }
  }
}

/**
 * Membuat atau Update IP Pool di MikroTik Router
 * @param conn Koneksi MikroTik yang sudah terbuka
 * @param poolName Nama pool (sama dengan remoteAddress yang akan digunakan di Profile PPP)
 * @param ipRange Range IP untuk pool (contoh: "192.168.1.100-192.168.1.200")
 */
async function createIPPool(
  conn: RouterOSAPI,
  poolName: string,
  ipRange: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Cek apakah pool sudah ada
    const existingPools = await conn.write('/ip/pool/print', ['?name=' + poolName])
    const exists = existingPools && existingPools.length > 0

    // Format comment untuk IP Pool: "add by netmanager - {poolName}"
    const poolComment = `add by netmanager - ${poolName}`

    if (exists && existingPools && existingPools[0]) {
      // Pool sudah ada, update ranges-nya
      const poolId = existingPools[0]['.id']
      // console.log('[MikroTik IP Pool] Pool sudah ada, updating ranges:', poolName, poolId)
      
      // Format ID dengan prefix =.id= (dengan = di awal untuk set command)
      const idParam = `=.id=${poolId}`
      const updateParams: string[] = [
        `=ranges=${ipRange}`,
        `=comment=${poolComment}`, // Tambahkan comment saat update
      ]
      
      const updateCommand = [idParam, ...updateParams]
      // console.log('[MikroTik IP Pool] Update command:', updateCommand)
      const updateResult = await conn.write('/ip/pool/set', updateCommand)
      // console.log('[MikroTik IP Pool] Update result:', JSON.stringify(updateResult, null, 2))
      
      // Check jika result mengandung error
      if (updateResult && Array.isArray(updateResult) && updateResult.length > 0) {
        const firstResult = updateResult[0]
        if (firstResult && firstResult['!trap']) {
          const errorMsg = firstResult['message'] || 'Terjadi kesalahan'
          return { success: false, error: `MikroTik error: ${errorMsg}` }
        }
      }
      
      // Verifikasi pool sudah diupdate
      await new Promise(resolve => setTimeout(resolve, 300))
      const verifyPools = await conn.write('/ip/pool/print', ['?name=' + poolName])
      
      if (!verifyPools || verifyPools.length === 0) {
        return { success: false, error: 'IP Pool diupdate tapi tidak ditemukan saat verifikasi' }
      }
      
      // console.log('[MikroTik IP Pool] Pool successfully updated:', verifyPools[0])
      return { success: true }
    }

    // Buat IP Pool baru
    const poolParams: string[] = [
      `=name=${poolName}`,
      `=ranges=${ipRange}`,
      `=comment=${poolComment}`, // Tambahkan comment saat create
    ]

    // console.log('[MikroTik IP Pool] Creating pool with params:', poolParams)
    const result = await conn.write('/ip/pool/add', poolParams)
    // console.log('[MikroTik IP Pool] Create result:', JSON.stringify(result, null, 2))

    // Check jika result mengandung error
    if (result && Array.isArray(result) && result.length > 0) {
      const firstResult = result[0]
      if (firstResult && firstResult['!trap']) {
        const errorMsg = firstResult['message'] || 'Terjadi kesalahan'
        return { success: false, error: `MikroTik error: ${errorMsg}` }
      }
    }

    // Verifikasi pool sudah dibuat
    await new Promise(resolve => setTimeout(resolve, 300))
    const verifyPools = await conn.write('/ip/pool/print', ['?name=' + poolName])
    
    if (!verifyPools || verifyPools.length === 0) {
      return { success: false, error: 'IP Pool dibuat tapi tidak ditemukan saat verifikasi' }
    }

    // console.log('[MikroTik IP Pool] Pool successfully created:', verifyPools[0])
    return { success: true }
  } catch (error) {
    console.error('[MikroTik IP Pool] Error creating/updating pool:', error)
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage || 'Gagal membuat/update IP Pool di MikroTik' }
  }
}

/**
 * Membuat profile PPP di MikroTik Router
 */
export async function createPPPProfileInMikroTik(
  routerId: string,
  profileData: PPPProfileData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Ambil data router dari database
    const router = await prisma.mikroTikRouter.findUnique({
      where: { id: routerId },
    })

    if (!router) {
      return { success: false, error: 'Router tidak ditemukan' }
    }

    const conn = await connectToMikroTik({
      ipAddress: router.ipAddress,
      apiPort: router.apiPort,
      apiUsername: router.apiUsernameGenerated || router.apiUsername,
      apiPassword: router.apiPasswordGenerated || router.apiPassword,
    })

    try {
      // Remote Address adalah nama IP Pool yang harus dibuat terlebih dahulu
      // Buat IP Pool jika ipRange disediakan
      if (profileData.ipRange && profileData.ipRange.trim() !== '') {
        // console.log('[MikroTik PPP] Creating IP Pool first:', profileData.remoteAddress, profileData.ipRange)
        const poolResult = await createIPPool(conn, profileData.remoteAddress, profileData.ipRange)
        if (!poolResult.success) {
          conn.close()
          return { success: false, error: `Gagal membuat IP Pool: ${poolResult.error}` }
        }
        // console.log('[MikroTik PPP] IP Pool created successfully')
      } else {
        // Cek apakah IP Pool sudah ada (jika tidak ada ipRange, asumsikan pool sudah dibuat manual)
        const poolExists = await checkIPPoolExists(conn, profileData.remoteAddress)
        if (!poolExists) {
          conn.close()
          return { success: false, error: `IP Pool "${profileData.remoteAddress}" tidak ditemukan. Silakan buat IP Pool terlebih dahulu atau berikan IP Range untuk membuat otomatis.` }
        }
        // console.log('[MikroTik PPP] IP Pool already exists:', profileData.remoteAddress)
      }

      // Prepare data untuk profile PPP
      // Format untuk node-routeros-v2: array of strings dengan format =key=value
      // Berdasarkan README: conn.write('/ip/address/add', ['=interface=ether2', '=address=192.168.90.1'])
      // Pastikan semua value tidak undefined atau null
      const profileParams: string[] = []
      
      // Name harus ada dan tidak kosong
      if (!profileData.name || profileData.name.trim() === '') {
        conn.close()
        return { success: false, error: 'Nama profile tidak boleh kosong' }
      }
      profileParams.push(`=name=${profileData.name}`)
      
      if (!profileData.localAddress || profileData.localAddress.trim() === '') {
        conn.close()
        return { success: false, error: 'Local address tidak boleh kosong' }
      }
      profileParams.push(`=local-address=${profileData.localAddress}`)
      
      if (!profileData.remoteAddress || profileData.remoteAddress.trim() === '') {
        conn.close()
        return { success: false, error: 'Remote address (nama IP Pool) tidak boleh kosong' }
      }
      // Remote address adalah nama IP Pool yang sudah dibuat
      profileParams.push(`=remote-address=${profileData.remoteAddress}`)

      // Tambahkan comment: "add by netmanager - {profileName}"
      const profileComment = `add by netmanager - ${profileData.name}`
      profileParams.push(`=comment=${profileComment}`)

      // Add optional fields
      if (profileData.dnsServer && profileData.dnsServer.trim() !== '') {
        profileParams.push(`=dns-server=${profileData.dnsServer}`)
      }

      if (profileData.sessionTimeout) {
        profileParams.push(`=session-timeout=${profileData.sessionTimeout}`)
      }

      if (profileData.idleTimeout) {
        profileParams.push(`=idle-timeout=${profileData.idleTimeout}`)
      }

      // Tambahkan rate-limit jika disediakan
      if (profileData.rateLimit && profileData.rateLimit.trim() !== '') {
        // console.log('[MikroTik PPP] Adding rate-limit to profile:', profileData.rateLimit)
        profileParams.push(`=rate-limit=${profileData.rateLimit}`)
      } else {
        // console.log('[MikroTik PPP] No rate-limit provided, profile will be created without rate limit')
      }

      // Create profile PPP di MikroTik
      // Format untuk node-routeros-v2: conn.write(path, params_array)
      // console.log('[MikroTik PPP] Creating profile with params:', profileParams)
      // console.log('[MikroTik PPP] Router:', router.ipAddress, router.apiPort)
      // console.log('[MikroTik PPP] Profile name:', profileData.name)
      // console.log('[MikroTik PPP] Rate limit value:', profileData.rateLimit || 'NOT SET')
      // console.log('[MikroTik PPP] All params:', JSON.stringify(profileParams, null, 2))
      
      // Format yang benar: conn.write(path, [array of =key=value strings])
      // Berdasarkan contoh di README
      const result = await conn.write('/ppp/profile/add', profileParams)
      // console.log('[MikroTik PPP] Create result:', JSON.stringify(result, null, 2))
      
      // Check jika result mengandung error
      if (result && Array.isArray(result) && result.length > 0) {
        const firstResult = result[0]
        if (firstResult && firstResult['!trap']) {
          const errorMsg = firstResult['message'] || 'Terjadi kesalahan'
          conn.close()
          return { success: false, error: `MikroTik error: ${errorMsg}` }
        }
      }

      // Tunggu sebentar untuk memastikan profile sudah dibuat
      await new Promise(resolve => setTimeout(resolve, 500))

      // Verifikasi profile sudah dibuat dengan print
      const verifyProfiles = await conn.write('/ppp/profile/print', ['?name=' + profileData.name])
      // console.log('[MikroTik PPP] Verification - Found profiles:', verifyProfiles)
      
      if (!verifyProfiles || verifyProfiles.length === 0) {
        // Coba print semua profile untuk debug
        const _allProfiles = await conn.write('/ppp/profile/print')
        // console.log('[MikroTik PPP] All profiles in router:', allProfiles)
        
        conn.close()
        return { success: false, error: 'Profile dibuat tapi tidak ditemukan saat verifikasi. Periksa log untuk detail.' }
      }

      const createdProfile = verifyProfiles[0]
      // console.log('[MikroTik PPP] Profile successfully created and verified:', createdProfile)

      // Verifikasi rate-limit
      if (createdProfile && profileData.rateLimit && profileData.rateLimit.trim() !== '') {
        const actualRateLimit = createdProfile['rate-limit'] || createdProfile['rateLimit'] || null
        // console.log('[MikroTik PPP] Rate limit verification:')
        // console.log('[MikroTik PPP]   Expected:', profileData.rateLimit)
        // console.log('[MikroTik PPP]   Actual:', actualRateLimit)
        
        if (!actualRateLimit || actualRateLimit.trim() === '') {
          console.warn('[MikroTik PPP] WARNING: rate-limit tidak ter-set di MikroTik!')
          console.warn('[MikroTik PPP] Profile data:', JSON.stringify(createdProfile, null, 2))
        } else if (actualRateLimit !== profileData.rateLimit) {
          console.warn('[MikroTik PPP] WARNING: rate-limit tidak sesuai!')
          console.warn('[MikroTik PPP]   Expected:', profileData.rateLimit)
          console.warn('[MikroTik PPP]   Got:', actualRateLimit)
        } else {
          // console.log('[MikroTik PPP] Rate limit verified successfully')
        }
      } else {
        // console.log('[MikroTik PPP] No rate limit expected, skipping verification')
      }

      conn.close()
      return { success: true }
    } catch (error) {
      conn.close()
      console.error('Error creating PPP profile in MikroTik:', error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage || 'Gagal membuat profile PPP di MikroTik' }
    }
  } catch (error) {
    console.error('Error connecting to MikroTik:', error)
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage || 'Gagal terhubung ke MikroTik Router' }
  }
}

/**
 * Update profile PPP di MikroTik Router
 */
export async function updatePPPProfileInMikroTik(
  routerId: string,
  profileName: string,
  profileData: Partial<PPPProfileData>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Ambil data router dari database
    const router = await prisma.mikroTikRouter.findUnique({
      where: { id: routerId },
    })

    if (!router) {
      return { success: false, error: 'Router tidak ditemukan' }
    }

    const conn = await connectToMikroTik({
      ipAddress: router.ipAddress,
      apiPort: router.apiPort,
      apiUsername: router.apiUsernameGenerated || router.apiUsername,
      apiPassword: router.apiPasswordGenerated || router.apiPassword,
    })

    try {
      // Cari profile berdasarkan name
      // console.log('[MikroTik PPP] Searching for profile:', profileName)
      const profiles = await conn.write('/ppp/profile/print', ['?name=' + profileName])
      // console.log('[MikroTik PPP] Found profiles:', profiles)
      
      if (!profiles || profiles.length === 0 || !profiles[0]) {
        conn.close()
        return { success: false, error: 'Profile PPP tidak ditemukan di MikroTik' }
      }

      const profileId = profiles[0]['.id']
      const oldProfileData = profiles[0]
      // console.log('[MikroTik PPP] Profile ID:', profileId)
      // console.log('[MikroTik PPP] Old profile data:', oldProfileData)

      // Handle IP Pool update jika remoteAddress berubah atau ipRange disediakan
      if (profileData.remoteAddress !== undefined || profileData.ipRange) {
        const newPoolName = profileData.remoteAddress || oldProfileData['remote-address']
        
        // Jika ipRange disediakan, update atau buat IP Pool
        if (profileData.ipRange && profileData.ipRange.trim() !== '') {
          // console.log('[MikroTik PPP] Updating IP Pool:', newPoolName, profileData.ipRange)
          const poolResult = await createIPPool(conn, newPoolName, profileData.ipRange)
          if (!poolResult.success) {
            console.error('[MikroTik PPP] Failed to update IP Pool:', poolResult.error)
            // Lanjutkan update profile meskipun IP Pool gagal diupdate
          } else {
            // console.log('[MikroTik PPP] IP Pool updated successfully')
          }
        } else if (profileData.remoteAddress && profileData.remoteAddress !== oldProfileData['remote-address']) {
          // Jika remoteAddress berubah tapi tidak ada ipRange, cek apakah pool baru sudah ada
          const poolExists = await checkIPPoolExists(conn, newPoolName)
          if (!poolExists) {
            conn.close()
            return { success: false, error: `IP Pool "${newPoolName}" tidak ditemukan. Silakan berikan IP Range untuk membuat otomatis.` }
          }
          // console.log('[MikroTik PPP] IP Pool already exists:', newPoolName)
        }
      }

      // Prepare data untuk update Profile PPP
      // Format untuk node-routeros-v2: array of strings dengan format =key=value
      // Kirim semua field yang disediakan untuk memastikan sinkronisasi dengan database
      const updateParams: string[] = []

      // Update name jika disediakan dan berbeda dari nama lama
      if (profileData.name !== undefined && profileData.name !== profileName) {
        updateParams.push(`=name=${profileData.name}`)
      }

      // Update localAddress jika disediakan
      if (profileData.localAddress !== undefined) {
        updateParams.push(`=local-address=${profileData.localAddress}`)
      }

      // Update remoteAddress jika disediakan
      if (profileData.remoteAddress !== undefined) {
        updateParams.push(`=remote-address=${profileData.remoteAddress}`)
      }

      // Update comment: "add by netmanager - {profileName}"
      // Gunakan name baru jika ada, jika tidak gunakan name lama
      const profileNameForComment = profileData.name && profileData.name !== profileName ? profileData.name : profileName
      const profileComment = `add by netmanager - ${profileNameForComment}`
      updateParams.push(`=comment=${profileComment}`)

      // Update dnsServer jika disediakan
      if (profileData.dnsServer !== undefined) {
        if (profileData.dnsServer && profileData.dnsServer.trim() !== '') {
          updateParams.push(`=dns-server=${profileData.dnsServer}`)
        } else {
          // Hapus dns-server jika dikosongkan
          updateParams.push('=dns-server=')
        }
      }

      // Update sessionTimeout jika disediakan
      if (profileData.sessionTimeout !== undefined) {
        if (profileData.sessionTimeout) {
          updateParams.push(`=session-timeout=${profileData.sessionTimeout}`)
        } else {
          // Hapus session-timeout jika dikosongkan
          updateParams.push('=session-timeout=')
        }
      }

      // Update idleTimeout jika disediakan
      if (profileData.idleTimeout !== undefined) {
        if (profileData.idleTimeout) {
          updateParams.push(`=idle-timeout=${profileData.idleTimeout}`)
        } else {
          // Hapus idle-timeout jika dikosongkan
          updateParams.push('=idle-timeout=')
        }
      }

      // Update rateLimit jika disediakan
      if (profileData.rateLimit !== undefined) {
        if (profileData.rateLimit && profileData.rateLimit.trim() !== '') {
          // console.log('[MikroTik PPP] Updating rate-limit:', profileData.rateLimit)
          updateParams.push(`=rate-limit=${profileData.rateLimit}`)
        } else {
          // Hapus rate-limit jika dikosongkan
          // console.log('[MikroTik PPP] Removing rate-limit')
          updateParams.push('=rate-limit=')
        }
      } else {
        // console.log('[MikroTik PPP] rateLimit not provided, skipping rate-limit update')
      }

      // Update profile PPP di MikroTik
      // Format untuk node-routeros-v2 set command: ['=.id=*1F', '=key=value', ...]
      // ID harus menggunakan format =.id= (dengan = di awal) untuk set command
      if (updateParams.length > 0) {
        // console.log('[MikroTik PPP] Updating profile:', profileId, updateParams)
        // Format ID dengan prefix =.id= (dengan = di awal untuk set command)
        const idParam = `=.id=${profileId}`
        const updateCommand = [idParam, ...updateParams]
        // console.log('[MikroTik PPP] Update command:', updateCommand)
        const result = await conn.write('/ppp/profile/set', updateCommand)
        // console.log('[MikroTik PPP] Update result:', JSON.stringify(result, null, 2))
        
        // Check jika result mengandung error
        if (result && Array.isArray(result) && result.length > 0) {
          const firstResult = result[0]
          if (firstResult && firstResult['!trap']) {
            const errorMsg = firstResult['message'] || 'Terjadi kesalahan'
            conn.close()
            return { success: false, error: `MikroTik error: ${errorMsg}` }
          }
        }
        
        // Tunggu sebentar untuk memastikan profile sudah diupdate
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Verifikasi profile sudah diupdate dengan print
        const verifyName = profileData.name && profileData.name !== profileName ? profileData.name : profileName
        const verifyProfiles = await conn.write('/ppp/profile/print', ['?name=' + verifyName])
        // console.log('[MikroTik PPP] Verification - Found profiles:', verifyProfiles)
        
        if (!verifyProfiles || verifyProfiles.length === 0 || !verifyProfiles[0]) {
          conn.close()
          return { success: false, error: 'Profile diupdate tapi tidak ditemukan saat verifikasi. Periksa log untuk detail.' }
        }

        const updatedProfile = verifyProfiles[0]
        // console.log('[MikroTik PPP] Profile successfully updated and verified:', updatedProfile)
        
        // Verifikasi rate-limit jika diupdate
        if (profileData.rateLimit !== undefined && profileData.rateLimit && profileData.rateLimit.trim() !== '') {
          const actualRateLimit = updatedProfile['rate-limit'] || updatedProfile['rateLimit'] || null
          // console.log('[MikroTik PPP] Rate limit verification after update:')
          // console.log('[MikroTik PPP]   Expected:', profileData.rateLimit)
          // console.log('[MikroTik PPP]   Actual:', actualRateLimit)
          
          if (!actualRateLimit || actualRateLimit.trim() === '') {
            console.warn('[MikroTik PPP] WARNING: rate-limit tidak ter-set di MikroTik setelah update!')
            console.warn('[MikroTik PPP] Profile data:', JSON.stringify(updatedProfile, null, 2))
          } else if (actualRateLimit !== profileData.rateLimit) {
            console.warn('[MikroTik PPP] WARNING: rate-limit tidak sesuai setelah update!')
            console.warn('[MikroTik PPP]   Expected:', profileData.rateLimit)
            console.warn('[MikroTik PPP]   Got:', actualRateLimit)
          } else {
            // console.log('[MikroTik PPP] Rate limit verified successfully after update')
          }
        }
        
        // Log perubahan yang terjadi
        if (profileData.localAddress && updatedProfile['local-address'] !== profileData.localAddress) {
          console.warn('[MikroTik PPP] WARNING: local-address tidak sesuai! Expected:', profileData.localAddress, 'Got:', updatedProfile['local-address'])
        }
        if (profileData.remoteAddress && updatedProfile['remote-address'] !== profileData.remoteAddress) {
          console.warn('[MikroTik PPP] WARNING: remote-address tidak sesuai! Expected:', profileData.remoteAddress, 'Got:', updatedProfile['remote-address'])
        }
        if (profileData.dnsServer && updatedProfile['dns-server'] !== profileData.dnsServer) {
          console.warn('[MikroTik PPP] WARNING: dns-server tidak sesuai! Expected:', profileData.dnsServer, 'Got:', updatedProfile['dns-server'])
        }
      } else {
        // console.log('[MikroTik PPP] No changes to update in profile')
      }

      conn.close()
      return { success: true }
    } catch (error) {
      conn.close()
      console.error('Error updating PPP profile in MikroTik:', error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage || 'Gagal mengupdate profile PPP di MikroTik' }
    }
  } catch (error) {
    console.error('Error connecting to MikroTik:', error)
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage || 'Gagal terhubung ke MikroTik Router' }
  }
}

/**
 * Hapus IP Pool di MikroTik Router
 * Hanya menghapus jika pool dibuat oleh netmanager (memiliki comment "add by netmanager")
 * @param conn Koneksi MikroTik yang sudah terbuka
 * @param poolName Nama IP Pool yang akan dihapus
 */
async function deleteIPPool(
  conn: RouterOSAPI,
  poolName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Cari IP Pool berdasarkan name
    // console.log('[MikroTik IP Pool] Searching for pool to delete:', poolName)
    const pools = await conn.write('/ip/pool/print', ['?name=' + poolName])
    // console.log('[MikroTik IP Pool] Found pools:', pools)
    
    if (!pools || pools.length === 0 || !pools[0]) {
      // Pool tidak ada, anggap berhasil (idempotent)
      // console.log('[MikroTik IP Pool] Pool tidak ditemukan, anggap berhasil')
      return { success: true }
    }

    const pool = pools[0]
    const poolId = pool['.id']
    const poolComment = pool['comment'] || ''

    // Hanya hapus jika pool dibuat oleh netmanager
    // Comment format: "add by netmanager - {poolName}"
    const expectedComment = `add by netmanager - ${poolName}`
    
    if (poolComment !== expectedComment) {
      // console.log('[MikroTik IP Pool] Pool tidak dibuat oleh netmanager, skip hapus')
      // console.log('[MikroTik IP Pool] Expected comment:', expectedComment)
      // console.log('[MikroTik IP Pool] Actual comment:', poolComment)
      // Pool tidak dibuat oleh netmanager, anggap berhasil (tidak error)
      return { success: true }
    }

    // console.log('[MikroTik IP Pool] Deleting pool:', poolName, 'ID:', poolId)

    // Hapus IP Pool di MikroTik
    // Untuk remove command, gunakan ID dengan format =.id=ID
    // Format: conn.write(path, ['=.id=ID'])
    const _result = await conn.write('/ip/pool/remove', ['=.id=' + poolId])
    // console.log('[MikroTik IP Pool] Delete result:', result)

    // Tunggu sebentar untuk memastikan pool sudah dihapus
    await new Promise(resolve => setTimeout(resolve, 500))

    // Verifikasi pool sudah dihapus
    const verifyPools = await conn.write('/ip/pool/print', ['?name=' + poolName])
    
    const firstPool = verifyPools?.[0]
    if (firstPool) {
      console.warn('[MikroTik IP Pool] WARNING: Pool masih ada setelah dihapus!')
      console.warn('[MikroTik IP Pool] Found pools:', verifyPools)
      // Coba hapus lagi dengan ID yang baru
      const retryPoolId = firstPool['.id']
      const retryPoolComment = firstPool['comment'] || ''
      // Pastikan masih pool yang dibuat oleh netmanager
      const expectedComment = `add by netmanager - ${poolName}`
      if (retryPoolComment === expectedComment) {
        // console.log('[MikroTik IP Pool] Retrying delete with ID:', retryPoolId)
        await conn.write('/ip/pool/remove', ['=.id=' + retryPoolId])
        // Tunggu lagi
        await new Promise(resolve => setTimeout(resolve, 1000))
        // Verifikasi lagi
        const verifyPools2 = await conn.write('/ip/pool/print', ['?name=' + poolName])
        if (verifyPools2 && verifyPools2.length > 0) {
          console.error('[MikroTik IP Pool] ERROR: Pool masih ada setelah retry delete!')
          console.error('[MikroTik IP Pool] Pool mungkin sedang digunakan atau ada masalah dengan MikroTik')
          return { success: false, error: 'IP Pool tidak dapat dihapus dari MikroTik. Pastikan pool tidak sedang digunakan.' }
        } else {
          // console.log('[MikroTik IP Pool] Pool successfully deleted after retry')
        }
      } else {
        // console.log('[MikroTik IP Pool] Pool comment tidak sesuai, skip retry (bukan pool netmanager)')
      }
    } else {
      // console.log('[MikroTik IP Pool] Pool successfully deleted and verified')
    }

    return { success: true }
  } catch (error) {
    console.error('[MikroTik IP Pool] Error deleting pool:', error)
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage || 'Gagal menghapus IP Pool di MikroTik' }
  }
}

/**
 * Hapus profile PPP di MikroTik Router
 * Juga menghapus IP Pool yang terkait jika dibuat oleh netmanager
 */
export async function deletePPPProfileInMikroTik(
  routerId: string,
  profileName: string,
  remoteAddress?: string // Nama IP Pool yang terkait dengan profile
): Promise<{ success: boolean; error?: string }> {
  try {
    // Ambil data router dari database
    const router = await prisma.mikroTikRouter.findUnique({
      where: { id: routerId },
    })

    if (!router) {
      return { success: false, error: 'Router tidak ditemukan' }
    }

    const conn = await connectToMikroTik({
      ipAddress: router.ipAddress,
      apiPort: router.apiPort,
      apiUsername: router.apiUsernameGenerated || router.apiUsername,
      apiPassword: router.apiPasswordGenerated || router.apiPassword,
    })

    try {
      // Cari profile berdasarkan name
      // console.log('[MikroTik PPP] Searching for profile to delete:', profileName)
      const profiles = await conn.write('/ppp/profile/print', ['?name=' + profileName])
      // console.log('[MikroTik PPP] Found profiles:', profiles)
      
      let profileRemoteAddress = remoteAddress
      
      // Jika remoteAddress tidak disediakan, ambil dari profile yang ditemukan
      const firstProfile = profiles?.[0]
      if (!profileRemoteAddress && firstProfile) {
        profileRemoteAddress = firstProfile['remote-address'] || firstProfile['remoteAddress']
        // console.log('[MikroTik PPP] Got remoteAddress from profile:', profileRemoteAddress)
      }
      
      if (!profiles || profiles.length === 0) {
        // Profile tidak ada, tapi tetap coba hapus IP Pool jika ada remoteAddress
        if (profileRemoteAddress) {
          // console.log('[MikroTik PPP] Profile tidak ditemukan, tapi akan coba hapus IP Pool:', profileRemoteAddress)
          const poolResult = await deleteIPPool(conn, profileRemoteAddress)
          if (!poolResult.success) {
            console.error('[MikroTik PPP] Failed to delete IP Pool:', poolResult.error)
          }
        }
        conn.close()
        // Anggap berhasil (idempotent)
        return { success: true }
      }

      const profileToDelete = profiles[0]
      if (!profileToDelete) {
          conn.close()
          return { success: true }
      }
      const profileId = profileToDelete['.id']
      // console.log('[MikroTik PPP] Deleting profile:', profileName, 'ID:', profileId)

      // Hapus profile PPP di MikroTik
      // Untuk remove command, gunakan ID dengan format =.id=ID
      // Format: conn.write(path, ['=.id=ID'])
      const _result = await conn.write('/ppp/profile/remove', ['=.id=' + profileId])
      // console.log('[MikroTik PPP] Delete result:', result)

      // Tunggu sebentar untuk memastikan profile sudah dihapus
      await new Promise(resolve => setTimeout(resolve, 500))

      // Verifikasi profile sudah dihapus
      const verifyProfiles = await conn.write('/ppp/profile/print', ['?name=' + profileName])
      if (verifyProfiles && verifyProfiles.length > 0) {
        console.warn('[MikroTik PPP] WARNING: Profile masih ada setelah dihapus!')
        console.warn('[MikroTik PPP] Found profiles:', verifyProfiles)
        // Coba hapus lagi dengan ID yang baru (retry)
        const retryProfile = verifyProfiles[0]
        if (!retryProfile) {
             // Should not happen if length > 0, but satisfies TS
             console.error('[MikroTik PPP] Error accessing retry profile')
             conn.close()
             return { success: false, error: 'Error accessing profile for retry' }
        }
        const retryProfileId = retryProfile['.id']
        // console.log('[MikroTik PPP] Retrying delete with ID:', retryProfileId)
        await conn.write('/ppp/profile/remove', ['=.id=' + retryProfileId])
        // Tunggu lagi
        await new Promise(resolve => setTimeout(resolve, 1000))
        // Verifikasi lagi
        const verifyProfiles2 = await conn.write('/ppp/profile/print', ['?name=' + profileName])
        if (verifyProfiles2 && verifyProfiles2.length > 0) {
          console.error('[MikroTik PPP] ERROR: Profile masih ada setelah retry delete!')
          console.error('[MikroTik PPP] Profile mungkin sedang digunakan atau ada masalah dengan MikroTik')
          conn.close()
          return { success: false, error: 'Profile tidak dapat dihapus dari MikroTik. Pastikan profile tidak sedang digunakan oleh PPPoE client.' }
        } else {
          // console.log('[MikroTik PPP] Profile successfully deleted after retry')
        }
      } else {
        // console.log('[MikroTik PPP] Profile successfully deleted and verified')
      }

      // Hapus IP Pool yang terkait jika ada remoteAddress
      if (profileRemoteAddress) {
        // console.log('[MikroTik PPP] Deleting associated IP Pool:', profileRemoteAddress)
        const poolResult = await deleteIPPool(conn, profileRemoteAddress)
        if (!poolResult.success) {
          console.error('[MikroTik PPP] Failed to delete IP Pool:', poolResult.error)
          // Jangan gagalkan request, hanya log error
          // Profile sudah dihapus, IP Pool bisa dihapus manual nanti jika diperlukan
        } else {
          // console.log('[MikroTik PPP] IP Pool successfully deleted')
        }
      } else {
        // console.log('[MikroTik PPP] No remoteAddress provided, skipping IP Pool deletion')
      }

      conn.close()
      return { success: true }
    } catch (error) {
      conn.close()
      console.error('Error deleting PPP profile in MikroTik:', error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage || 'Gagal menghapus profile PPP di MikroTik' }
    }
  } catch (error) {
    console.error('Error connecting to MikroTik:', error)
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage || 'Gagal terhubung ke MikroTik Router' }
  }
}

