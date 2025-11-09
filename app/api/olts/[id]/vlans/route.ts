import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import snmp from 'net-snmp'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

// SNMP OIDs untuk VLAN (Standard MIB dan ZTE specific)
const SNMP_VLAN_OIDS = {
  // Standard BRIDGE-MIB untuk VLAN
  // dot1qVlanStaticTable: 1.3.6.1.2.1.17.7.1.4.3.1.1 (VLAN ID)
  // dot1qVlanStaticName: 1.3.6.1.2.1.17.7.1.4.3.1.2 (VLAN Name)
  // dot1qVlanStaticEgressPorts: 1.3.6.1.2.1.17.7.1.4.3.1.3 (Egress Ports)
  // dot1qVlanStaticUntaggedPorts: 1.3.6.1.2.1.17.7.1.4.3.1.4 (Untagged Ports)
  vlanId: '1.3.6.1.2.1.17.7.1.4.3.1.1', // dot1qVlanStaticId
  vlanName: '1.3.6.1.2.1.17.7.1.4.3.1.2', // dot1qVlanStaticName
  vlanEgressPorts: '1.3.6.1.2.1.17.7.1.4.3.1.3', // dot1qVlanStaticEgressPorts
  vlanUntaggedPorts: '1.3.6.1.2.1.17.7.1.4.3.1.4', // dot1qVlanStaticUntaggedPorts
  
  // ZTE specific OIDs (jika ada)
  // Coba beberapa OID yang mungkin digunakan ZTE untuk VLAN
  zteVlanBase: '1.3.6.1.4.1.3902.1082', // ZTE Enterprise OID
  // Mungkin ada di: 1.3.6.1.4.1.3902.1082.500.10.x.x untuk VLAN management
}

// Helper function untuk SNMP walk
async function snmpWalk(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 30000
): Promise<Array<{ oid: string; value: any; type?: number }>> {
  return new Promise((resolve, reject) => {
    let resolved = false
    let session: any = null
    let timeoutId: NodeJS.Timeout | null = null
    const results: Array<{ oid: string; value: any; type?: number }> = []
    let pendingCallbacks = 0
    let isClosing = false

    const finish = (error?: any) => {
      if (resolved) return
      resolved = true
      
      if (timeoutId) clearTimeout(timeoutId)
      
      if (session) {
        try {
          session.close()
        } catch (e) {
          // Ignore
        }
      }

      if (error) {
        reject(error)
      } else {
        resolve(results)
      }
    }

    try {
      let snmpVersion: 0 | 1 | undefined = 1 // Default: Version2c
      if (version === '1') {
        snmpVersion = 0 // Version1
      } else if (version === '3') {
        console.warn(`[VLAN-SNMP] SNMP v3 is not supported, using v2c instead`)
        snmpVersion = 1 // Fallback to Version2c
      }

      session = snmp.createSession(ipAddress, community, {
        port,
        version: snmpVersion,
        retries: 3,
        timeout: 10000,
      })

      timeoutId = setTimeout(() => {
        if (!resolved) {
          console.log(`[VLAN-SNMP] Walk timeout reached with ${results.length} results`)
          finish(results.length > 0 ? undefined : new Error('SNMP walk timeout'))
        }
      }, timeout)

      const processCallback = (varbinds: any[]) => {
        if (resolved || isClosing) return

        for (const varbind of varbinds) {
          if (snmp.isVarbindError(varbind)) {
            if (varbind.value === snmp.EndOfMibView) {
              console.log(`[VLAN-SNMP] EndOfMibView reached, total results: ${results.length}`)
              finish()
              return
            }
            continue
          }

          results.push({
            oid: varbind.oid.toString(),
            value: varbind.value,
            type: varbind.type,
          })
        }
      }

      session.subtree(oid, processCallback, (error: any) => {
        if (resolved || isClosing) return

        if (error) {
          console.error(`[VLAN-SNMP] Walk error:`, error)
          if (results.length > 0) {
            // Jika sudah ada hasil, return hasil yang ada
            finish()
          } else {
            finish(error)
          }
        } else {
          finish()
        }
      })
    } catch (error) {
      finish(error)
    }
  })
}

// Helper function untuk SNMP get
async function snmpGet(
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
          // Ignore
        }
      }
      resolve(value)
    }

    try {
      let snmpVersion: 0 | 1 | undefined = 1 // Default: Version2c
      if (version === '1') {
        snmpVersion = 0 // Version1
      } else if (version === '3') {
        console.warn(`[VLAN-SNMP] SNMP v3 is not supported, using v2c instead`)
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

// Extract VLAN ID dari OID
// Format OID: 1.3.6.1.2.1.17.7.1.4.3.1.X.Y dimana Y adalah VLAN ID
function extractVlanIdFromOid(oid: string, baseOid: string): number | null {
  if (!oid.startsWith(baseOid)) return null
  
  const suffix = oid.substring(baseOid.length)
  const parts = suffix.split('.').filter(p => p)
  
  // Untuk BRIDGE-MIB, index biasanya di akhir OID
  // Format: baseOid.VLAN_ID
  if (parts.length > 0) {
    const vlanId = parseInt(parts[parts.length - 1])
    if (!isNaN(vlanId) && vlanId > 0 && vlanId <= 4094) {
      return vlanId
    }
  }
  
  return null
}

// Parse VLAN data dari SNMP results
function parseVlanFromSnmp(
  vlanIdResults: Array<{ oid: string; value: any }>,
  vlanNameResults: Array<{ oid: string; value: any }>,
  vlanEgressResults: Array<{ oid: string; value: any }>,
  vlanUntaggedResults: Array<{ oid: string; value: any }>
): Array<{ vlanId: number; name: string; description: string; ports: string[] }> {
  const vlans: Map<number, { vlanId: number; name: string; description: string; ports: string[] }> = new Map()

  // Parse VLAN IDs - value adalah VLAN ID, index dari OID juga bisa digunakan
  for (const result of vlanIdResults) {
    // Coba ambil dari value dulu
    let vlanId = parseInt(result.value.toString())
    
    // Jika value tidak valid, coba dari OID index
    if (isNaN(vlanId) || vlanId <= 0 || vlanId > 4094) {
      const oidVlanId = extractVlanIdFromOid(result.oid, SNMP_VLAN_OIDS.vlanId)
      if (oidVlanId) {
        vlanId = oidVlanId
      } else {
        continue // Skip jika tidak bisa extract VLAN ID
      }
    }
    
    if (vlanId > 0 && vlanId <= 4094) {
      vlans.set(vlanId, {
        vlanId,
        name: `VLAN${vlanId}`,
        description: '',
        ports: [],
      })
    }
  }

  // Parse VLAN Names
  for (const result of vlanNameResults) {
    const vlanId = extractVlanIdFromOid(result.oid, SNMP_VLAN_OIDS.vlanName)
    
    if (vlanId && vlans.has(vlanId)) {
      const name = result.value.toString().trim()
      if (name && name !== '') {
        vlans.get(vlanId)!.name = name
        vlans.get(vlanId)!.description = name // Gunakan name sebagai description juga
      }
    }
  }

  // Parse Egress Ports (tagged ports)
  for (const result of vlanEgressResults) {
    const vlanId = extractVlanIdFromOid(result.oid, SNMP_VLAN_OIDS.vlanEgressPorts)
    
    if (vlanId && vlans.has(vlanId)) {
      // Port bitmap - perlu di-parse
      const portBitmap = result.value
      if (Buffer.isBuffer(portBitmap)) {
        const ports = parsePortBitmap(portBitmap)
        vlans.get(vlanId)!.ports = ports
      } else if (typeof portBitmap === 'string') {
        // Jika berupa string, coba parse sebagai port list
        const ports = portBitmap.split(',').map(p => p.trim()).filter(p => p)
        vlans.get(vlanId)!.ports = ports
      }
    }
  }

  // Parse Untagged Ports
  for (const result of vlanUntaggedResults) {
    const vlanId = extractVlanIdFromOid(result.oid, SNMP_VLAN_OIDS.vlanUntaggedPorts)
    
    if (vlanId && vlans.has(vlanId)) {
      const portBitmap = result.value
      if (Buffer.isBuffer(portBitmap)) {
        const ports = parsePortBitmap(portBitmap)
        // Merge dengan egress ports (tagged)
        const existingPorts = vlans.get(vlanId)!.ports
        vlans.get(vlanId)!.ports = [...new Set([...existingPorts, ...ports])]
      } else if (typeof portBitmap === 'string') {
        const ports = portBitmap.split(',').map(p => p.trim()).filter(p => p)
        const existingPorts = vlans.get(vlanId)!.ports
        vlans.get(vlanId)!.ports = [...new Set([...existingPorts, ...ports])]
      }
    }
  }

  return Array.from(vlans.values()).sort((a, b) => a.vlanId - b.vlanId)
}

// Parse port bitmap dari SNMP (OCTET STRING)
function parsePortBitmap(bitmap: Buffer): string[] {
  const ports: string[] = []
  
  // Bitmap: setiap bit mewakili port
  // Bit 0 = port 1, bit 1 = port 2, dst
  for (let byteIndex = 0; byteIndex < bitmap.length; byteIndex++) {
    const byte = bitmap[byteIndex]
    for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
      if (byte & (1 << bitIndex)) {
        const portNumber = byteIndex * 8 + bitIndex + 1
        ports.push(portNumber.toString())
      }
    }
  }
  
  return ports
}


export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const oltRepository = getOLTRepository()
  const olt = await oltRepository.findById(id)

  if (!olt) {
    return NextResponse.json({ error: 'OLT tidak ditemukan' }, { status: 404 })
  }

  if (!olt.snmpConnected) {
    return NextResponse.json(
      { error: 'SNMP tidak connected. Silakan test connection terlebih dahulu.' },
      { status: 400 }
    )
  }

  if (!olt.snmpCommunityWrite) {
    return NextResponse.json(
      { error: 'SNMP community tidak ditemukan di data OLT.' },
      { status: 400 }
    )
  }

  try {
    console.log(`[VLAN-SNMP] Fetching VLAN data from OLT ${olt.name} (${olt.ipAddress}) via SNMP...`)

    // Walk semua OID VLAN secara paralel
    const [vlanIdResults, vlanNameResults, vlanEgressResults, vlanUntaggedResults] = await Promise.all([
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.vlanId, 30000),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.vlanName, 30000),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.vlanEgressPorts, 30000),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.vlanUntaggedPorts, 30000),
    ])

    console.log(`[VLAN-SNMP] Found ${vlanIdResults.length} VLAN IDs`)
    console.log(`[VLAN-SNMP] Found ${vlanNameResults.length} VLAN Names`)
    console.log(`[VLAN-SNMP] Found ${vlanEgressResults.length} Egress Port entries`)
    console.log(`[VLAN-SNMP] Found ${vlanUntaggedResults.length} Untagged Port entries`)

    // Parse VLAN data
    const vlanDetails = parseVlanFromSnmp(vlanIdResults, vlanNameResults, vlanEgressResults, vlanUntaggedResults)

    console.log(`[VLAN-SNMP] Parsed ${vlanDetails.length} VLANs`)

    return NextResponse.json({
      olt: {
        id: olt.id,
        name: olt.name,
        ipAddress: olt.ipAddress,
      },
      vlans: vlanDetails,
      total: vlanDetails.length,
    })
  } catch (error: any) {
    console.error('[VLAN-SNMP] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Gagal memuat data VLAN dari SNMP',
        details: error.toString(),
      },
      { status: 500 }
    )
  }
}

