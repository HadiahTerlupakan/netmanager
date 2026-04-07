import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

export const dynamic = 'force-dynamic'
import { prisma } from '@/modules/database'
import { getTenantIdFromContext } from '@/lib/tenant-context'
import axios from 'axios'

export const GET = createHandler({ auth: true, permissions: ['acs:read'] }, async () => {
  try {
    const { tenantId, isSuperAdmin } = await getTenantIdFromContext()
    
    // 1. Ambil pengaturan ACS dari database
    const settingsKeys = [
      'ACS_GENIEACS_URL',
      'ACS_VP_PPPOE_USERNAME',
      'ACS_VP_WAN_BRIDGE',
      'ACS_VP_RX_POWER',
      'ACS_VP_TEMPERATURE',
      'ACS_VP_ACTIVE_DEVICES'
    ]

    const settings = await prisma.settings.findMany({
      where: { key: { in: settingsKeys } }
    })

    const config = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value
      return acc
    }, {} as Record<string, string>)

    if (!config['ACS_GENIEACS_URL']) {
      return ApiErrors.internalError('GenieACS URL belum dikonfigurasi di Pengaturan.')
    }

    let baseUrl = config['ACS_GENIEACS_URL'].trim()
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)

    // Parameter mapping
    const vpPppoeUsername = config['ACS_VP_PPPOE_USERNAME'] || 'VirtualParameters.pppoeUsername2'
    const vpWanBridge = config['ACS_VP_WAN_BRIDGE'] || 'VirtualParameters.WANBridge'
    const vpRxPower = config['ACS_VP_RX_POWER'] || 'VirtualParameters.RXPower'
    const vpTemperature = config['ACS_VP_TEMPERATURE'] || 'VirtualParameters.gettemp'
    const vpActiveDevices = config['ACS_VP_ACTIVE_DEVICES'] || 'VirtualParameters.activedevices'

    // Parameter yang ingin diambil dari GenieACS
    const projection = [
      '_id',
      '_deviceId._ProductClass',
      '_deviceId._SerialNumber',
      '_deviceId._Manufacturer',
      '_deviceId._OUI',
      '_tags',
      vpPppoeUsername,
      vpWanBridge,
      vpRxPower,
      vpTemperature,
      vpActiveDevices,
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
      'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress',
      'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',
      'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.2.ExternalIPAddress',
      '_lastInform'
    ]

    // Multi-tenant isolation for GenieACS: Filter by tenant tag
    const queryCond: Record<string, string> = {}
    if (!isSuperAdmin && tenantId) {
      queryCond._tags = `tenant:${tenantId}`
    }

    const apiUrl = `${baseUrl}?query=${encodeURIComponent(JSON.stringify(queryCond))}&projection=${encodeURIComponent(projection.join(','))}`

    const response = await axios.get(apiUrl, {
      timeout: 15000,
      headers: { 'Accept': 'application/json' }
    })

    if (response.status !== 200 && response.status !== 201) {
      return ApiErrors.internalError(`Gagal mengambil data dari GenieACS (Status: ${response.status})`)
    }

    const data = response.data

    if (!Array.isArray(data)) {
      return ApiErrors.internalError('Format respon dari GenieACS tidak valid (bukan array)')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getNestedValue = (obj: any, path: string) => {
      const parts = path.split('.')
      let current = obj
      for (const part of parts) {
        if (current && typeof current === 'object') {
          current = current[part]
        } else {
          return null
        }
      }
      return current?._value || null
    }

    // Proses data (persis seperti logika aslinya)
    const formattedData = data.map(item => {
      const deviceId = item._id || null
      const serialNumber = item._deviceId?._SerialNumber || null
      const productClass = item._deviceId?._ProductClass || null
      const manufacturer = item._deviceId?._Manufacturer || null
      const tags = Array.isArray(item._tags) ? item._tags : []

      const pppoe = getNestedValue(item, vpPppoeUsername)
      const wanbridge = getNestedValue(item, vpWanBridge)
      const rxpower = getNestedValue(item, vpRxPower)
      const temperature = getNestedValue(item, vpTemperature)
      const activeDevices = getNestedValue(item, vpActiveDevices)

      const ssid1 = item.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration?.['1']?.SSID?._value || null

      const ip1 = getNestedValue(item, 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress')
      const ip2 = getNestedValue(item, 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress')
      const ip3 = getNestedValue(item, 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.2.ExternalIPAddress')
      const ipAddress = ip1 || ip2 || ip3 || '-'

      const lastInform = item._lastInform || null

      return {
        id: deviceId,
        serialNumber,
        productClass,
        manufacturer,
        tags,
        pppoe,
        wanbridge,
        rxpower,
        temperature,
        activeDevices,
        ssid: ssid1,
        ipAddress,
        lastInform
      }
    })

    return apiSuccess({
      devices: formattedData.reverse() // Menampilkan dari yang terbaru
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error fetching ACS devices:', error.message)
    return ApiErrors.internalError(`Koneksi ke GenieACS gagal: ${error.message}`)
  }
})
