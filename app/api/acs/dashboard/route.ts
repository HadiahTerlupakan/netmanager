import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import axios from 'axios'

export const GET = createHandler({ auth: true, permissions: ['acs:read'] }, async () => {
  try {
    const settingsKeys = [
      'ACS_GENIEACS_URL',
      'ACS_DEVICE_ONLINE_THRESHOLD',
      'ACS_VP_RX_POWER',
      'ACS_RX_POWER_EXCELLENT',
      'ACS_RX_POWER_FAIR'
    ]

    const settings = await prisma.settings.findMany({
      where: { key: { in: settingsKeys } }
    })

    const config = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value
      return acc
    }, {} as Record<string, string>)

    if (!config['ACS_GENIEACS_URL']) {
      return ApiErrors.internalError('GenieACS URL belum dikonfigurasi.')
    }

    let baseUrl = config['ACS_GENIEACS_URL'].trim()
    if (baseUrl.endsWith('/devices') || baseUrl.endsWith('/devices/')) {
      baseUrl = baseUrl.replace(/\/devices\/?$/, '')
    } else {
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
    }

    const onlineThresholdMinutes = parseInt(config['ACS_DEVICE_ONLINE_THRESHOLD'] || '10', 10)
    const thresholdAgo = new Date(Date.now() - (onlineThresholdMinutes * 60 * 1000))
    const vpRxPower = config['ACS_VP_RX_POWER'] || 'VirtualParameters.RXPower'

    // 1. Fetch total devices
    const devicesRes = await axios.get(`${baseUrl}/devices?projection=_id,_deviceId._ProductClass,_lastInform,${vpRxPower}`, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    })

    const devices = Array.isArray(devicesRes.data) ? devicesRes.data : []
    const totalDevices = devices.length

    // Calculate Online / Offline
    const onlineDevices = devices.filter(d => {
      if (!d._lastInform) return false
      return new Date(d._lastInform) > thresholdAgo
    }).length

    const offlineDevices = totalDevices - onlineDevices

    // Mock Faults for now
    const faults = Math.floor(Math.random() * 5)

    const metrics = [
      { name: "Total Devices", value: totalDevices, status: "up", change: 2 },
      { name: "Online", value: onlineDevices, status: "up", change: 1 },
      { name: "Offline", value: offlineDevices, status: "down", change: 0 },
      { name: "Faults", value: faults, status: "warning", change: 0 }
    ]

    // Calculate Vendor distribution
    const productClasses: Record<string, number> = {}
    devices.forEach(d => {
      const pc = d._deviceId?._ProductClass || 'Unknown'
      productClasses[pc] = (productClasses[pc] || 0) + 1
    })

    // Read vendor configs for better naming
    const vendors = await prisma.acsVendor.findMany()

    const connectionTypes = Object.entries(productClasses)
      .map(([name, value]) => {
        let vendorName = name
        // Try to match product class with vendor patterns
        for (const v of vendors) {
          const patterns = v.productPatterns.split(',').map((p: string) => p.trim().toLowerCase())
          if (patterns.some((p: string) => name.toLowerCase().includes(p))) {
            vendorName = v.name
            break
          }
        }
        return { name: vendorName, value, original: name }
      })
      .reduce((acc: { name: string; value: number; original?: string }[], curr) => {
        const existing = acc.find(x => x.name === curr.name)
        if (existing) {
          existing.value += curr.value
        } else {
          acc.push({ name: curr.name, value: curr.value })
        }
        return acc
      }, [])
      .sort((a: { value: number }, b: { value: number }) => b.value - a.value)

    // RX Power calculation
    const excellentThreshold = parseInt(config['ACS_RX_POWER_EXCELLENT'] || '-23', 10)
    const fairThreshold = parseInt(config['ACS_RX_POWER_FAIR'] || '-26', 10)

    let excellent = 0, fair = 0, poor = 0, unknown = 0
    const paramName = vpRxPower.split('.').pop() || 'RXPower'

    devices.forEach(d => {
      let rxStr = null
      if (d.VirtualParameters && d.VirtualParameters[paramName]) {
        rxStr = d.VirtualParameters[paramName]._value
      } else if (d[vpRxPower]) {
        rxStr = d[vpRxPower]._value || d[vpRxPower]
      }

      if (!rxStr || isNaN(parseFloat(rxStr))) {
        unknown++
      } else {
        const pwr = parseFloat(rxStr)
        if (pwr >= excellentThreshold) excellent++
        else if (pwr >= fairThreshold) fair++
        else poor++
      }
    })

    const rxPowerDistribution = {
      labels: ["Excellent", "Fair", "Poor", "N/A"],
      series: [excellent, fair, poor, unknown],
      colors: ["#10B981", "#FBBF24", "#EF4444", "#9CA3AF"]
    }

    return apiSuccess({
      metrics,
      connectionTypes,
      rxPowerDistribution,
      totalDevices
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error fetching ACS dashboard data:', error.message)
    return ApiErrors.internalError('Gagal mengambil data dashboard ACS')
  }
})
