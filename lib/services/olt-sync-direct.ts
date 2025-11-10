/**
 * Direct sync function untuk OLT data (tanpa melalui API)
 * Digunakan oleh scheduler untuk menghindari auth issues
 */

import { getOLTRepository } from '@/lib/repositories'
import snmp from 'net-snmp'

// SNMP OIDs untuk ZTE-C300 dan umum
const SNMP_OIDS = {
  sysDescr: '1.3.6.1.2.1.1.1.0', // System description (version info)
  sysUpTime: '1.3.6.1.2.1.1.3.0', // System uptime
  sysName: '1.3.6.1.2.1.1.5.0', // System name
  temperature: '1.3.6.1.4.1.3902.1015.2.1.3.2.0', // ZTE C300-B temperature
  connectedDevices: '1.3.6.1.2.1.2.1.0', // Number of interfaces
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
          // Ignore close errors
        }
      }
      resolve(value)
    }

    try {
      let snmpVersion: 0 | 1 | undefined = 1 // Default: Version2c
      if (version === '1') {
        snmpVersion = 0 // Version1
      } else if (version === '3') {
        console.warn(`[SNMP] SNMP v3 is not supported, using v2c instead`)
        snmpVersion = 1 // Fallback to Version2c
      }

      session = snmp.createSession(ipAddress, community, {
        port,
        version: snmpVersion,
        retries: 2,
        timeout: 5000,
      })

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

/**
 * Sync OLT data langsung dari SNMP (tanpa melalui API)
 */
export async function syncOltDataDirect(oltId: string): Promise<boolean> {
  const oltRepo = getOLTRepository()
  const olt = await oltRepo.findById(oltId)

  if (!olt) {
    throw new Error('OLT tidak ditemukan')
  }

  if (!olt.snmpConnected) {
    console.log(`[OLT-Sync-Direct] SNMP not connected for OLT ${olt.name}`)
    return false
  }

  try {
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

    // Update OLT dengan data yang didapat
    const updateData: any = {
      syncStatus: '100',
      syncDate: new Date(),
    }

    if (version) updateData.version = version.substring(0, 200) // Limit length
    if (uptime) updateData.uptime = uptime
    if (temperature !== null && !isNaN(temperature)) updateData.temperature = temperature
    if (connectedDevices !== null && !isNaN(connectedDevices) && connectedDevices >= 0) {
      updateData.connectedDevices = connectedDevices
    }
    if (model) updateData.model = model

    await oltRepo.update(oltId, updateData)

    console.log(`[OLT-Sync-Direct] Successfully synced OLT ${olt.name}`)
    return true
  } catch (error: any) {
    console.error(`[OLT-Sync-Direct] Error syncing OLT ${olt.name}:`, error?.message || error)
    return false
  }
}



