import { RadiusConnectionError } from '../utils/errors';
import { getMikroTikRouterRepository } from '@/lib/repositories'
import { RouterOSAPI } from 'node-routeros-v2'
import { NetworkRepository } from '../repositories/NetworkRepository'

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
        } catch (_e) {
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
          const pppActive = await conn.write('/ppp/active/print')
          const userOnline = Array.isArray(pppActive) ? pppActive.length : 0

          cleanup()
          clearTimeout(timer)
          resolve({ success: true, userOnline })
        } catch (_error: unknown) {
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

export async function checkAllMikroTikRouterStatus(): Promise<number> {
  try {
    const routerRepository = getMikroTikRouterRepository()
    const networkRepo = new NetworkRepository()
    
    const tenants = await networkRepo.findActiveTenants()

    let totalUpdatedCount = 0

    for (const tenant of tenants) {
      try {
        const routers = await routerRepository.findAll(tenant.id)

        const checkPromises = routers.map(async (router) => {
          try {
            const apiUsername = router.apiUsernameGenerated || router.apiUsername
            const apiPassword = router.apiPasswordGenerated || router.apiPassword
            
            const apiResult = await testMikroTikAPI(
              router.ipAddress,
              router.apiPort,
              apiUsername,
              apiPassword,
              5000
            )

            await routerRepository.update(router.id, {
              pingStatus: apiResult.success ? 'online' : 'offline',
              userOnline: apiResult.userOnline ?? 0,
              lastStatusCheck: new Date(),
            }, tenant.id)

            return { id: router.id, success: apiResult.success, userOnline: apiResult.userOnline ?? 0 }
          } catch (error: unknown) {
            console.error(`Error checking router ${router.id}:`, error)
            try {
              await routerRepository.update(router.id, {
                pingStatus: 'offline',
                userOnline: 0,
                lastStatusCheck: new Date(),
              }, tenant.id)
            } catch (updateError: unknown) {
              console.error(`Error updating router ${router.id}:`, updateError)
            }
            return { id: router.id, success: false, userOnline: 0 }
          }
        })

        const results = await Promise.all(checkPromises)
        totalUpdatedCount += results.length
      } catch (tenantError) {
        console.error(`Error checking routers for tenant ${tenant.id}:`, tenantError)
      }
    }

    return totalUpdatedCount
  } catch (error: unknown) {
    throw error
  }
}

export async function checkSingleMikroTikRouterStatus(id: string): Promise<boolean> {
  try {
    const routerRepository = getMikroTikRouterRepository()
    const networkRepo = new NetworkRepository()
    
    const routerData = await networkRepo.findRouterTenantId(id)

    if (!routerData?.tenantId) return false

    const router = await routerRepository.findById(id, routerData.tenantId)

    if (!router) return false

    const apiUsername = router.apiUsernameGenerated || router.apiUsername
    const apiPassword = router.apiPasswordGenerated || router.apiPassword

    const apiResult = await testMikroTikAPI(
      router.ipAddress,
      router.apiPort,
      apiUsername,
      apiPassword,
      5000
    )

    await routerRepository.update(router.id, {
      pingStatus: apiResult.success ? 'online' : 'offline',
      userOnline: apiResult.userOnline ?? 0,
      lastStatusCheck: new Date(),
    }, routerData.tenantId)

    return apiResult.success
  } catch (error: unknown) {
    console.error(`Error checking single router ${id}:`, error)
    throw new RadiusConnectionError("Gagal terhubung ke router: " + (error instanceof Error ? error.message : String(error)))
  }
}
