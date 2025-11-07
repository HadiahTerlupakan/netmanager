import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import snmp from 'net-snmp'
import '@/lib/utils/event-emitter-config'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

// SNMP OIDs untuk ZTE-C300 dan umum
const SNMP_OIDS = {
  sysDescr: '1.3.6.1.2.1.1.1.0', // System description (version info)
  sysUpTime: '1.3.6.1.2.1.1.3.0', // System uptime
  sysName: '1.3.6.1.2.1.1.5.0', // System name
  // Multiple OIDs untuk temperature (coba beberapa OID umum)
  temperature: [
    '1.3.6.1.4.1.3902.1015.1.1.1.1.1.1', // ZTE-C300 temperature
    '1.3.6.1.4.1.3902.1015.1.1.1.1.1.2', // ZTE-C300 temperature alt
    '1.3.6.1.4.1.3902.1015.1.1.1.1.1.3', // ZTE-C300 temperature alt 2
    '1.3.6.1.4.1.3902.1015.3.1.1.1.1.1', // ZTE-C300 temperature alt 3
    '1.3.6.1.2.1.25.1.8.0', // Host Resources MIB - temperature
    '1.3.6.1.4.1.9.9.13.1.3.1.3', // CISCO temperature (fallback)
  ],
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
      let snmpVersion = snmp.Version2c
      if (version === '1') {
        snmpVersion = snmp.Version1
      } else if (version === '3') {
        snmpVersion = snmp.Version3
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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const oltRepository = getOLTRepository()
  const olt = await oltRepository.findById(id)

  if (!olt) {
    return NextResponse.json({ error: 'OLT tidak ditemukan' }, { status: 404 })
  }

  if (!olt.snmpConnected) {
    return NextResponse.json({ error: 'SNMP tidak connected. Silakan test connection terlebih dahulu.' }, { status: 400 })
  }

  try {
    // Get data dari SNMP
    const [version, uptimeStr, model, devicesStr] = await Promise.all([
      getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.sysDescr),
      getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.sysUpTime),
      getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.sysName),
      getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.connectedDevices),
    ])

    // Try multiple OIDs for temperature
    let tempStr: string | null = null
    for (const tempOid of SNMP_OIDS.temperature) {
      tempStr = await getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, tempOid)
      if (tempStr !== null && tempStr !== '') {
        break // Found temperature value, stop searching
      }
    }

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

    await oltRepository.update(id, updateData)

    return NextResponse.json({
      success: true,
      message: 'Data berhasil di-sync dari device',
      data: {
        version: updateData.version || olt.version,
        temperature: updateData.temperature !== undefined ? updateData.temperature : olt.temperature,
        connectedDevices: updateData.connectedDevices !== undefined ? updateData.connectedDevices : olt.connectedDevices,
        uptime: updateData.uptime || olt.uptime,
        model: updateData.model || olt.model,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal sync data dari device' }, { status: 500 })
  }
}

