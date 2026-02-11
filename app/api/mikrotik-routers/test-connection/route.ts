import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getMikroTikRouterRepository } from '@/lib/repositories'
import { RouterOSAPI } from 'node-routeros-v2'

async function requireAdmin() {
  const session = await getServerSession(authConfig)
  if (!session) {
    return null
  }
  return session
}

// Interface for Router Information
interface RouterInfo {
  identity: string;
  version: string;
  boardName: string;
  uptime: string;
  userOnline: number;
}

// Test MikroTik API connection menggunakan node-routeros-v2
async function testMikroTikAPI(
  ipAddress: string,
  port: number,
  username: string,
  password: string,
  timeout: number = 10000
): Promise<{ success: boolean; message: string; routerInfo?: RouterInfo }> {
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
        } catch (_e) {
          // Ignore cleanup errors
        }
      }
    }

    const timer = setTimeout(() => {
      cleanup()
      resolve({
        success: false,
        message: `Koneksi API timeout setelah ${timeout}ms - kemungkinan kredensial salah atau router tidak dapat dijangkau`,
      })
    }, timeout + 1000)

    conn
      .connect()
      .then(async () => {
        try {
          // Test dengan mengambil system resource atau identity
          let identity: unknown = null
          let resource: unknown = null
          let pppActive: unknown = null

          try {
            identity = await conn.write('/system/identity/print')
          } catch (e) {
            console.log('Failed to get identity:', e)
          }

          try {
            resource = await conn.write('/system/resource/print')
          } catch (e) {
            console.log('Failed to get resource:', e)
          }

          try {
            pppActive = await conn.write('/ppp/active/print')
          } catch (e) {
            console.log('Failed to get ppp active:', e)
          }

          cleanup()
          clearTimeout(timer)

          // Handle response format - could be array or object
          const identityData = Array.isArray(identity) ? (identity[0] as Record<string, unknown>) : (identity as Record<string, unknown>)
          const resourceData = Array.isArray(resource) ? (resource[0] as Record<string, unknown>) : (resource as Record<string, unknown>)
          const userOnline = Array.isArray(pppActive) ? pppActive.length : 0

          const routerInfo: RouterInfo = {
            identity: 'Unknown',
            version: 'Unknown',
            boardName: 'Unknown',
            uptime: 'Unknown',
            userOnline: userOnline
          }

          if (identityData) {
            routerInfo.identity = (identityData.name || identityData['.name'] || 'Unknown') as string
          }

          if (resourceData) {
            routerInfo.version = (resourceData.version || resourceData['.version'] || 'Unknown') as string
            routerInfo.boardName = (resourceData['board-name'] || resourceData.boardName || 'Unknown') as string
            routerInfo.uptime = (resourceData.uptime || resourceData['.uptime'] || 'Unknown') as string
          }

          resolve({
            success: true,
            message: `Koneksi API berhasil! Router: ${routerInfo.identity}, Version: ${routerInfo.version}, User Online: ${userOnline}`,
            routerInfo,
          })
        } catch (error: unknown) {
          cleanup()
          clearTimeout(timer)
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.error('Error getting router info:', error)
          resolve({
            success: true,
            message: `Koneksi API berhasil, tetapi gagal mengambil informasi router: ${errorMsg}`,
          })
        }
      })
      .catch((error: { message?: string; code?: string }) => {
        cleanup()
        clearTimeout(timer)

        let errorMessage = 'Koneksi API gagal'

        if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
          errorMessage = `Koneksi timeout - kemungkinan IP Address salah atau router tidak dapat dijangkau`
        } else if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
          errorMessage = `Port ${port} ditolak - kemungkinan API MikroTik tidak aktif atau firewall memblokir`
        } else if (error.message?.includes('ENOTFOUND') || error.code === 'ENOTFOUND') {
          errorMessage = `Host ${ipAddress} tidak dapat dijangkau`
        } else if (error.message?.includes('invalid user name or password') || error.message?.includes('authentication')) {
          errorMessage = `Autentikasi gagal - Username atau Password salah`
        } else {
          errorMessage = `Koneksi API gagal: ${error.message || error.code || 'Terjadi kesalahan'}`
        }

        resolve({
          success: false,
          message: errorMessage,
        })
      })
  })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

  try {
    const body = await req.json()
    const {
      ipAddress: initialIpAddress,
      apiPort: initialApiPort = 8728,
      apiUsername: initialApiUsername,
      apiPassword: initialApiPassword,
      routerId, // Optional: untuk update status connection di database
    } = body

    let ipAddress = initialIpAddress
    let apiPort = initialApiPort
    let apiUsername = initialApiUsername
    let apiPassword = initialApiPassword

    // Jika routerId ada, ambil data router dari database dan gunakan generated user jika tersedia
    if (routerId) {
      try {
        const routerRepository = getMikroTikRouterRepository()
        const router = await routerRepository.findById(routerId)
        if (router) {
          // Override dengan data dari database
          ipAddress = router.ipAddress
          apiPort = router.apiPort
          // Gunakan generated user jika tersedia, fallback ke master
          apiUsername = router.apiUsernameGenerated || router.apiUsername
          apiPassword = router.apiPasswordGenerated || router.apiPassword
          console.log(`[Test Connection] Using ${router.apiUsernameGenerated ? 'generated' : 'master'} user for router ${router.name}`)
        }
      } catch (e) {
        console.error('Error fetching router:', e)
      }
    }

    if (!ipAddress) {
      return NextResponse.json({ error: 'IP Address is required' }, { status: 400 })
    }

    // Validate port
    const finalApiPort = apiPort && !isNaN(Number(apiPort)) && Number(apiPort) > 0 && Number(apiPort) <= 65535
      ? Number(apiPort)
      : 8728

    // Test MikroTik API (if credentials provided)
    let apiResult: { success: boolean; message: string; routerInfo?: RouterInfo } | null = null
    if (apiUsername && apiPassword) {
      apiResult = await testMikroTikAPI(ipAddress, finalApiPort, apiUsername, apiPassword, 10000)
    } else {
      apiResult = {
        success: false,
        message: 'Username/Password tidak disediakan untuk test koneksi API',
      }
    }

    // API connection is the main indicator
    const overallSuccess = apiResult.success

    // Update connection status di database jika routerId tersedia
    if (routerId && overallSuccess && apiResult.routerInfo) {
      try {
        const routerRepository = getMikroTikRouterRepository()
        await routerRepository.update(routerId, {
          pingStatus: 'online', // Set online jika API connection berhasil
          userOnline: apiResult.routerInfo.userOnline || 0,
          lastStatusCheck: new Date(),
        })
      } catch (error: unknown) {
        // Log error tapi tidak fail request
        console.error('Error updating connection status:', error)
      }
    } else if (routerId) {
      // Update status ke offline jika test gagal
      try {
        const routerRepository = getMikroTikRouterRepository()
        await routerRepository.update(routerId, {
          pingStatus: 'offline',
          userOnline: 0,
          lastStatusCheck: new Date(),
        })
      } catch (error: unknown) {
        console.error('Error updating connection status:', error)
      }
    }

    return NextResponse.json({
      success: overallSuccess,
      api: apiResult,
      routerInfo: apiResult?.routerInfo || null,
      message: overallSuccess
        ? 'Koneksi berhasil! API dapat diakses dengan autentikasi yang benar.'
        : 'Koneksi gagal. Periksa IP Address, port, username, password, and pastikan router dapat dijangkau dari server ini.',
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Test connection failed'
    console.error('Error testing MikroTik connection:', error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

