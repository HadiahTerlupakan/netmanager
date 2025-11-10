/**
 * Service untuk mengecek status API connection semua MikroTik Router
 * Digunakan oleh scheduler untuk update status secara berkala
 */

import { getMikroTikRouterRepository } from '@/lib/repositories'
import { RouterOSAPI } from 'node-routeros-v2'

/**
 * Test API connection ke router dan ambil jumlah user online
 */
async function testMikroTikAPI(
  ipAddress: string,
  port: number,
  username: string,
  password: string,
  timeout: number = 5000
): Promise<{ success: boolean; userOnline?: number }> {
  return new Promise((resolve) => {
    const conn = new RouterOSAPI({
      host: ipAddress,
      user: username,
      password: password,
      port: port,
      timeout: timeout,
    })

    let resolved = false

    const cleanup = () => {
      if (!resolved) {
        resolved = true
        try {
          conn.close()
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }

    const timer = setTimeout(() => {
      cleanup()
      resolve({ success: false })
    }, timeout + 1000)

    conn
      .connect()
      .then(async () => {
        try {
          // Get active PPP users
          const pppActive = await conn.write('/ppp/active/print')
          const userOnline = Array.isArray(pppActive) ? pppActive.length : 0
          
          cleanup()
          clearTimeout(timer)
          resolve({ success: true, userOnline })
        } catch (error: any) {
          // Jika gagal ambil data, tetap anggap koneksi berhasil
          cleanup()
          clearTimeout(timer)
          resolve({ success: true, userOnline: 0 })
        }
      })
      .catch(() => {
        cleanup()
        clearTimeout(timer)
        resolve({ success: false })
      })
  })
}

/**
 * Cek status API connection semua router dan update di database
 * @returns Jumlah router yang diupdate
 */
export async function checkAllMikroTikRouterStatus(): Promise<number> {
  try {
    const routerRepository = getMikroTikRouterRepository()
    const routers = await routerRepository.findAll()
    
    let updatedCount = 0
    
    // Check status untuk setiap router secara parallel
    const checkPromises = routers.map(async (router) => {
      try {
        // Test API connection dan ambil jumlah user online
        const apiResult = await testMikroTikAPI(
          router.ipAddress,
          router.apiPort,
          router.apiUsername,
          router.apiPassword,
          5000
        )
        
        // Update status di database berdasarkan API connection
        await routerRepository.update(router.id, {
          pingStatus: apiResult.success ? 'online' : 'offline',
          userOnline: apiResult.userOnline ?? 0,
          lastStatusCheck: new Date(),
        })
        
        updatedCount++
        return { id: router.id, success: apiResult.success, userOnline: apiResult.userOnline ?? 0 }
      } catch (error: any) {
        console.error(`Error checking router ${router.id}:`, error)
        // Update ke offline jika error
        try {
          await routerRepository.update(router.id, {
            pingStatus: 'offline',
            userOnline: 0,
            lastStatusCheck: new Date(),
          })
        } catch (updateError) {
          console.error(`Error updating router ${router.id}:`, updateError)
        }
        return { id: router.id, success: false, userOnline: 0 }
      }
    })
    
    await Promise.all(checkPromises)
    
    return updatedCount
  } catch (error: any) {
    console.error('Error checking MikroTik router status:', error)
    throw error
  }
}

