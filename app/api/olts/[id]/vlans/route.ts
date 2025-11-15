import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import snmp from 'net-snmp'
import { Telnet } from 'telnet-client'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

// SNMP OIDs untuk VLAN
// 1. Standard BRIDGE-MIB (untuk kompatibilitas dengan berbagai vendor)
// 2. ZTE-specific OIDs (dari dokumentasi ZTE-AN-VLAN-MIB.mib)
const SNMP_VLAN_OIDS = {
  // Standard BRIDGE-MIB OIDs
  vlanId: '1.3.6.1.2.1.17.7.1.4.2.1.3', // dot1qVlanCurrentEgressPorts - untuk mendapatkan list VLAN IDs
  vlanName: '1.3.6.1.2.1.17.7.1.4.3.1.1', // dot1qVlanStaticName - mengembalikan nama VLAN
  vlanEgressPorts: '1.3.6.1.2.1.17.7.1.4.3.1.2', // dot1qVlanStaticEgressPorts (tagged ports)
  vlanUntaggedPorts: '1.3.6.1.2.1.17.7.1.4.3.1.4', // dot1qVlanStaticUntaggedPorts
  ifDescr: '1.3.6.1.2.1.2.2.1.2', // Interface description untuk mapping port index ke port fisik
  ifName: '1.3.6.1.2.1.31.1.1.1.1', // Interface name (IF-MIB, mungkin lebih akurat untuk ZTE)
  ifIndex: '1.3.6.1.2.1.2.2.1.1', // Interface index (untuk mapping BRIDGE-MIB port number)
  dot1dBasePortIfIndex: '1.3.6.1.2.1.17.1.4.1.2', // BRIDGE-MIB port number -> IF-MIB interface index mapping
  
  // ZTE-specific OIDs (dari dokumentasi ZTE-AN-VLAN-MIB.mib)
  // VLAN Interface (L3 Interface) - untuk mendapatkan VLAN interface dengan IP address
  zteL3IfTable: '1.3.6.1.4.1.3902.1015.4.1.1', // zxAnL3IfTable - Base OID untuk L3 Interface Table
  zteL3IfIndex: '1.3.6.1.4.1.3902.1015.4.1.1.1.1', // zxAnL3IfIndex - Interface index
  zteL3IfName: '1.3.6.1.4.1.3902.1015.4.1.1.1.2', // zxAnL3IfName - VLAN Interface Name (e.g., "VLAN100")
  zteL3IfReferIndex: '1.3.6.1.4.1.3902.1015.4.1.1.1.3', // zxAnIfReferIndex - Referenced interface index
  zteL3IfArpProxyEnable: '1.3.6.1.4.1.3902.1015.4.1.1.1.4', // zxAnL3IfArpProxyEnable - ARP proxy enable
  zteL3IfRowStatus: '1.3.6.1.4.1.3902.1015.4.1.1.1.5', // zxAnL3IfRowStatus - Row status
  
  // VLAN Interface IP Address
  zteL3IfIpTable: '1.3.6.1.4.1.3902.1015.4.1.3', // zxAnL3IfIpAddressTable - Base OID untuk IP Address Table
  zteL3IfIp: '1.3.6.1.4.1.3902.1015.4.1.3.1.1', // zxAnL3IfIp - IP Address of VLAN Interface
  zteL3IfMask: '1.3.6.1.4.1.3902.1015.4.1.3.1.2', // zxAnL3IfMask - Subnet Mask
  zteL3IfIpCategory: '1.3.6.1.4.1.3902.1015.4.1.3.1.3', // zxAnL3IfIpCatagory - IP Category
  zteL3IfIpRowStatus: '1.3.6.1.4.1.3902.1015.4.1.3.1.4', // zxAnL3IfIpRowStatus - Row status
  
  // VLAN Port Configuration
  zteVlanPortConfTable: '1.3.6.1.4.1.3902.1015.20.4', // zxAnVlanPortConfVlanCmdTable - Base OID untuk VLAN Port Config
  zteVlanPortConfCmd: '1.3.6.1.4.1.3902.1015.20.4.1.1', // zxAnVlanPortConfVlanCmd - VLAN command
  zteVlanPortConfVlanId: '1.3.6.1.4.1.3902.1015.20.4.1.2', // zxAnVlanPortConfVlanId - VLAN ID
  
  // Service Port VLAN Configuration
  zteUserTlsVlan: '1.3.6.1.4.1.3902.1015.8.1.1.1.10', // zxAnUserTlsVlan - User TLS VLAN
  zteVlanTransMode: '1.3.6.1.4.1.3902.1015.8.1.1.1.13', // zxAnVlanTransMode - VLAN Translation Mode
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

      // Validasi OID sebelum dipanggil
      if (!oid || typeof oid !== 'string' || oid.trim() === '') {
        console.error(`[VLAN-SNMP] Invalid OID provided: ${oid}`)
        finish(new Error(`Invalid OID: ${oid}`))
        return
      }

      const oidString = String(oid).trim()
      session.subtree(oidString, processCallback, (error: any) => {
        if (resolved || isClosing) return

        if (error) {
          console.error(`[VLAN-SNMP] Walk error for OID ${oidString}:`, error)
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
// Format OID untuk vlanId (1.3.6.1.2.1.17.7.1.4.2.1.3): 1.3.6.1.2.1.17.7.1.4.2.1.3.0.VLAN_ID
// Format OID untuk vlanName (1.3.6.1.2.1.17.7.1.4.3.1.1): 1.3.6.1.2.1.17.7.1.4.3.1.1.VLAN_ID
function extractVlanIdFromOid(oid: string, baseOid: string): number | null {
  if (!oid.startsWith(baseOid)) return null
  
  const suffix = oid.substring(baseOid.length)
  const parts = suffix.split('.').filter(p => p)
  
  // Untuk vlanId OID (1.3.6.1.2.1.17.7.1.4.2.1.3), format: baseOid.0.VLAN_ID
  // Untuk vlanName OID (1.3.6.1.2.1.17.7.1.4.3.1.1), format: baseOid.VLAN_ID
  if (baseOid === '1.3.6.1.2.1.17.7.1.4.2.1.3') {
    // Format: baseOid.0.VLAN_ID
    if (parts.length >= 2 && parts[0] === '0') {
      const vlanId = parseInt(parts[1])
      if (!isNaN(vlanId) && vlanId > 0 && vlanId <= 4094) {
        return vlanId
      }
    }
  } else {
    // Format: baseOid.VLAN_ID
    if (parts.length > 0) {
      const vlanId = parseInt(parts[parts.length - 1])
      if (!isNaN(vlanId) && vlanId > 0 && vlanId <= 4094) {
        return vlanId
      }
    }
  }
  
  return null
}

// Parse VLAN data dari SNMP results
function parseVlanFromSnmp(
  vlanIdResults: Array<{ oid: string; value: any }>,
  vlanNameResults: Array<{ oid: string; value: any }>,
  vlanEgressResults: Array<{ oid: string; value: any }>,
  vlanUntaggedResults: Array<{ oid: string; value: any }>,
  ifDescrResults: Array<{ oid: string; value: any }>,
  ifNameResults: Array<{ oid: string; value: any }>,
  ifIndexResults: Array<{ oid: string; value: any }>,
  dot1dBasePortIfIndexResults: Array<{ oid: string; value: any }>
): Array<{ vlanId: number; name: string; description: string; ports: string[] }> {
  // Build interface description map untuk mapping IF-MIB interface index ke port fisik
  const ifDescrMap = buildIfDescrMap(ifDescrResults, ifNameResults)
  
  // Build mapping BRIDGE-MIB port number -> IF-MIB interface index
  // Gunakan dot1dBasePortIfIndex jika tersedia, jika tidak gunakan strategi fallback
  const bridgePortToIfIndexMap = new Map<number, number>()
  
  // dot1dBasePortIfIndex: BRIDGE-MIB port number -> IF-MIB interface index
  // Format OID: 1.3.6.1.2.1.17.1.4.1.2.BRIDGE_PORT_NUMBER = INTEGER: IF_MIB_INTERFACE_INDEX
  for (const result of dot1dBasePortIfIndexResults) {
    const oidParts = result.oid.split('.')
    if (oidParts.length > 0) {
      const bridgePortNumber = parseInt(oidParts[oidParts.length - 1])
      const ifIndex = parseInt(result.value.toString())
      if (!isNaN(bridgePortNumber) && !isNaN(ifIndex) && bridgePortNumber > 0 && ifIndex > 0) {
        bridgePortToIfIndexMap.set(bridgePortNumber, ifIndex)
      }
    }
  }
  
  // Fallback: jika dot1dBasePortIfIndex tidak tersedia, build mapping dari ifIndex results
  // Untuk ZTE, BRIDGE-MIB port number mungkin tidak sama dengan IF-MIB interface index
  // Tapi kita bisa coba build mapping berdasarkan urutan interface index
  if (bridgePortToIfIndexMap.size === 0) {
    // Strategi: Build mapping berdasarkan urutan interface index yang ada
    // Asumsi: BRIDGE-MIB port number mengikuti urutan interface index yang ada
    // Kita akan sort interface index dan mapping port number berdasarkan urutan
    
    const sortedIfIndexes = Array.from(ifDescrMap.keys()).sort((a, b) => a - b)
    
    // Dari log, kita tahu bahwa:
    // - Port number 648 di BRIDGE-MIB seharusnya di-mapping ke interface index 285280769 (xgei_1/10/1)
    // - Port number 644-647, 708-712 juga perlu di-mapping
    // 
    // Coba mapping berdasarkan pola: port number besar (644+) mungkin di-mapping ke interface index besar
    // Kita akan coba mapping di parsePortBitmap dengan mencari interface index yang cocok
    // berdasarkan port number dan interface index yang ada
    
    // Untuk sekarang, kita akan handle di parsePortBitmap dengan mencari interface index yang cocok
  }
  
  const vlans: Map<number, { vlanId: number; name: string; description: string; ports: string[] }> = new Map()

  // Parse VLAN Names sebagai primary source (karena lebih lengkap dan sudah include VLAN ID di OID)
  // Format: 1.3.6.1.2.1.17.7.1.4.3.1.1.VLAN_ID = STRING: "VLAN0001" atau "VLAN0098-PPP"
  for (const result of vlanNameResults) {
    const vlanId = extractVlanIdFromOid(result.oid, SNMP_VLAN_OIDS.vlanName)
    
    if (vlanId) {
      const name = result.value.toString().trim()
      if (name && name !== '') {
        vlans.set(vlanId, {
          vlanId,
          name,
          description: name, // Gunakan name sebagai description juga
          ports: [],
        })
      }
    }
  }

  // Parse VLAN IDs dari vlanIdResults sebagai fallback (jika ada VLAN yang tidak ada di vlanNameResults)
  // Format: 1.3.6.1.2.1.17.7.1.4.2.1.3.0.VLAN_ID = Gauge32: VLAN_ID
  for (const result of vlanIdResults) {
    // Value dari OID ini adalah VLAN ID
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
    
    // Hanya tambahkan jika belum ada di map (dari vlanNameResults)
    if (vlanId > 0 && vlanId <= 4094 && !vlans.has(vlanId)) {
      vlans.set(vlanId, {
        vlanId,
        name: `VLAN${String(vlanId).padStart(4, '0')}`, // Format: VLAN0001, VLAN0098, dll
        description: '',
        ports: [],
      })
    }
  }

  // Parse Egress Ports (tagged ports)
  for (const result of vlanEgressResults) {
    const vlanId = extractVlanIdFromOid(result.oid, SNMP_VLAN_OIDS.vlanEgressPorts)
    
    if (vlanId && vlans.has(vlanId)) {
      // Port bitmap - perlu di-parse dan map ke interface description
      const portBitmap = result.value
      if (Buffer.isBuffer(portBitmap)) {
        const ports = parsePortBitmap(portBitmap, ifDescrMap, bridgePortToIfIndexMap)
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
        const ports = parsePortBitmap(portBitmap, ifDescrMap, bridgePortToIfIndexMap)
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

// Konversi PONID ke Frame/Slot/Port (sama seperti di ONU)
// Rumus: PONID = (Frame * 16777216) + (Slot * 65536) + (Port * 256)
// CATATAN: Rumus ini hanya valid untuk PON ID yang menggunakan format ini
// Jangan gunakan untuk interface index biasa yang bukan PON ID
function ponIdToFrameSlotPort(ponId: number): { frame: number; slot: number; port: number } | null {
  // Validasi: PON ID harus cukup besar untuk menggunakan rumus ini
  // Jika terlalu kecil, kemungkinan bukan PON ID
  if (ponId < 16777216) {
    return null
  }
  
  const frame = Math.floor(ponId / 16777216)
  const remainder1 = ponId % 16777216
  const slot = Math.floor(remainder1 / 65536)
  const remainder2 = remainder1 % 65536
  const port = Math.floor(remainder2 / 256)
  
  // Validasi hasil
  if (frame < 1 || frame > 255 || slot < 1 || slot > 255 || port < 1 || port > 255) {
    return null
  }
  
  // Validasi tambahan: jika hasilnya terlalu kecil (misalnya frame=0, slot=0, port=1),
  // kemungkinan bukan PON ID yang valid
  if (frame === 0 && slot === 0) {
    return null
  }
  
  return { frame, slot, port }
}

// Convert PON index ke format Frame/Slot/Port menggunakan binary parsing
// Format binary: [4 bit type][4 bit shelf][8 bit frame][8 bit slot][8 bit port]
function ponIndexToPort(ponIndex: number): string | null {
  // Convert ke binary 32-bit (pad dengan leading zeros)
  const binary = ponIndex.toString(2).padStart(32, '0')
  
  if (binary.length !== 32) {
    return null
  }
  
  // Parse sesuai format: [4 bit type][4 bit shelf][8 bit frame][8 bit slot][8 bit port]
  const onuFrame = binary.substring(8, 16)      // bits 8-15 (Frame)
  const onuSlot = binary.substring(16, 24)     // bits 16-23
  const onuPort = binary.substring(24, 32)     // bits 24-31
  
  // Convert binary ke decimal
  const frame = parseInt(onuFrame, 2) || 1
  const slot = parseInt(onuSlot, 2) || 1
  const port = parseInt(onuPort, 2)
  
  // PORT MULAI DARI 1, BUKAN 0!
  if (port === 0) {
    return null
  }
  
  return `${frame}/${slot}/${port}`
}

// Parse port bitmap dari SNMP (OCTET STRING) dan map ke interface descriptions atau konversi PON index
// Port bitmap menggunakan BRIDGE-MIB port number, bukan IF-MIB interface index langsung
// Kita perlu mapping dari BRIDGE-MIB port number ke IF-MIB interface index
function parsePortBitmap(bitmap: Buffer, ifDescrMap: Map<number, string>, bridgePortToIfIndexMap: Map<number, number>): string[] {
  const ports: string[] = []
  const portMappingLog: Array<{ bridgePort: number; ifIndex: number | null; ifDescr: string | null; result: string }> = []
  
  // Build sorted list of interface indexes untuk fallback mapping
  const sortedIfIndexes = Array.from(ifDescrMap.keys()).sort((a, b) => a - b)
  
  // Bitmap: setiap bit mewakili BRIDGE-MIB port number
  // Bit 0 = port number 1, bit 1 = port number 2, dst
  // Catatan: BRIDGE-MIB port number berbeda dari IF-MIB interface index
  for (let byteIndex = 0; byteIndex < bitmap.length; byteIndex++) {
    const byte = bitmap[byteIndex]
    if (byte === 0) continue // Skip byte kosong untuk performa
    
    for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
      if (byte & (1 << bitIndex)) {
        // BRIDGE-MIB port number = (byteIndex * 8) + bitIndex + 1
        // byteIndex 0, bitIndex 0 = port number 1
        // byteIndex 0, bitIndex 7 = port number 8
        // byteIndex 5, bitIndex 7 = port number 48
        const bridgePortNumber = byteIndex * 8 + bitIndex + 1
        
        // Map BRIDGE-MIB port number ke IF-MIB interface index
        let interfaceIndex = bridgePortToIfIndexMap.get(bridgePortNumber)
        
        if (!interfaceIndex) {
          // Fallback: jika mapping tidak tersedia, coba strategi fallback
          
          // Strategi 1: Mapping khusus untuk port number yang diketahui (prioritas tinggi)
          // Untuk port number 644-648, coba cari interface xgei_1/10/*
          if (bridgePortNumber >= 644 && bridgePortNumber <= 648) {
            const portOffset = bridgePortNumber - 644 // 0-4
            for (const [idx, descr] of ifDescrMap.entries()) {
              const xgeiMatch = descr.match(/xgei_1\/10\/(\d+)/i)
              if (xgeiMatch) {
                const portNum = parseInt(xgeiMatch[1])
                if (portNum === portOffset + 1) {
                  interfaceIndex = idx
                  break
                }
              }
            }
          }
          
          // Untuk port number 708-712, coba cari interface xgei_1/11/*
          if (!interfaceIndex && bridgePortNumber >= 708 && bridgePortNumber <= 712) {
            const portOffset = bridgePortNumber - 708 // 0-4
            for (const [idx, descr] of ifDescrMap.entries()) {
              const xgeiMatch = descr.match(/xgei_1\/11\/(\d+)/i)
              if (xgeiMatch) {
                const portNum = parseInt(xgeiMatch[1])
                if (portNum === portOffset + 1) {
                  interfaceIndex = idx
                  break
                }
              }
            }
          }
          
          // Strategi 2: Coba cari interface berdasarkan pola atau urutan
          // Kumpulkan semua interface yang relevan (gpon, xgei, gei)
          if (!interfaceIndex) {
            const relevantInterfaces: Array<{ idx: number; descr: string; portMatch: RegExpMatchArray | null }> = []
            for (const [idx, descr] of ifDescrMap.entries()) {
              if (descr && descr.trim() !== '') {
                const gponMatch = descr.match(/gpon-olt_(\d+\/\d+\/\d+)/i) || 
                                 descr.match(/gpon_(\d+\/\d+\/\d+)/i)
                const xgeiMatch = descr.match(/xgei_(\d+\/\d+\/\d+)/i)
                const geiMatch = descr.match(/gei_(\d+\/\d+\/\d+)/i)
                
                if (gponMatch || xgeiMatch || geiMatch) {
                  relevantInterfaces.push({ 
                    idx, 
                    descr, 
                    portMatch: gponMatch || xgeiMatch || geiMatch 
                  })
                }
              }
            }
            
            // Sort berdasarkan interface index untuk konsistensi
            relevantInterfaces.sort((a, b) => a.idx - b.idx)
            
            // Strategi 2a: Coba mapping berdasarkan urutan (port number -> urutan interface)
            // Jika bridgePortNumber dalam range jumlah interface yang relevan
            if (bridgePortNumber <= relevantInterfaces.length && relevantInterfaces.length > 0) {
              interfaceIndex = relevantInterfaces[bridgePortNumber - 1].idx
            } else if (relevantInterfaces.length > 0) {
              // Strategi 2b: Untuk port number besar, coba cari interface yang index-nya mendekati
              // Cari interface yang index-nya paling dekat dengan bridgePortNumber
              let closestInterface: { idx: number; descr: string } | null = null
              let minDiff = Infinity
              
              for (const { idx, descr } of relevantInterfaces) {
                const diff = Math.abs(idx - bridgePortNumber)
                if (diff < minDiff) {
                  minDiff = diff
                  closestInterface = { idx, descr }
                }
              }
              
              // Hanya gunakan jika perbedaannya tidak terlalu besar (threshold: 100000)
              if (closestInterface && minDiff < 100000) {
                interfaceIndex = closestInterface.idx
              }
            }
          }
          
          // Strategi 3: Untuk port number kecil, coba sequential mapping sebagai last resort
          // Port number 1 -> interface index pertama, port number 2 -> interface index kedua, dst
          if (!interfaceIndex && bridgePortNumber <= sortedIfIndexes.length && bridgePortNumber > 0 && bridgePortNumber < 100) {
            interfaceIndex = sortedIfIndexes[bridgePortNumber - 1]
          }
        }
        
        // Jika interfaceIndex tidak ditemukan sama sekali, coba gunakan bridgePortNumber sebagai fallback
        // Tapi hanya jika bridgePortNumber masuk akal (tidak terlalu besar)
        if (!interfaceIndex && bridgePortNumber < 10000) {
          interfaceIndex = bridgePortNumber
        }
        
        // Coba cari interface description/name terlebih dahulu
        let ifDescr = ifDescrMap.get(interfaceIndex)
        
        // Jika tidak ditemukan dengan interfaceIndex langsung, coba cari dengan strategi lain
        if (!ifDescr || ifDescr.trim() === '') {
          // Strategi 1: Coba cari interface yang memiliki port number yang cocok
          // Berdasarkan bridgePortNumber, coba cari interface yang mungkin cocok
          // Ini berguna untuk OLT yang mapping BRIDGE-MIB port number tidak langsung
          
          // Coba cari interface berdasarkan pola port number
          // Untuk port number besar, mungkin interface index juga besar
          // Coba cari interface yang memiliki index mendekati bridgePortNumber atau interfaceIndex
          for (const [idx, descr] of ifDescrMap.entries()) {
            // Jika interface index mendekati bridgePortNumber atau interfaceIndex yang dihitung
            // dan description mengandung pola port (gpon, xgei, gei), gunakan itu
            const diff = Math.abs(idx - interfaceIndex)
            if (diff < 1000 && descr && descr.trim() !== '') {
              // Cek apakah description mengandung pola port
              if (descr.match(/gpon|gei|xgei|pon/i)) {
                ifDescr = descr
                interfaceIndex = idx // Update interfaceIndex untuk konsistensi
                break
              }
            }
          }
          
          // Strategi 2: Jika masih tidak ditemukan, coba cari semua interface GPON
          // dan coba match berdasarkan pola port number atau urutan
          if (!ifDescr || ifDescr.trim() === '') {
            // Kumpulkan semua interface GPON dan sort berdasarkan index
            const gponInterfaces: Array<{ idx: number; descr: string; portMatch: RegExpMatchArray | null }> = []
            for (const [idx, descr] of ifDescrMap.entries()) {
              if (descr && descr.trim() !== '') {
                const gponMatch = descr.match(/gpon-olt_(\d+\/\d+\/\d+)/i) || 
                                 descr.match(/gpon_(\d+\/\d+\/\d+)/i)
                if (gponMatch) {
                  gponInterfaces.push({ idx, descr, portMatch: gponMatch })
                }
              }
            }
            
            // Sort berdasarkan interface index
            gponInterfaces.sort((a, b) => a.idx - b.idx)
            
            // Jika ada interface GPON, coba mapping berdasarkan urutan
            // bridgePortNumber -> urutan interface GPON
            if (gponInterfaces.length > 0) {
              // Coba mapping berdasarkan urutan: port number -> urutan interface GPON
              // Jika bridgePortNumber dalam range, gunakan mapping langsung
              if (bridgePortNumber <= gponInterfaces.length) {
                const selected = gponInterfaces[bridgePortNumber - 1]
                ifDescr = selected.descr
                interfaceIndex = selected.idx
              } else {
                // Untuk port number besar, coba modulo mapping
                const mappedIndex = ((bridgePortNumber - 1) % gponInterfaces.length)
                const selected = gponInterfaces[mappedIndex]
                ifDescr = selected.descr
                interfaceIndex = selected.idx
              }
            }
          }
        }
        
        if (ifDescr && ifDescr.trim() !== '') {
          // Extract port dari description/name
          // Format bisa: "gpon-olt_1/3/4", "gpon_1/3/4", "xgei_1/10/1", "gei_1/10/5", "1/3/4", dll
          // ifName biasanya menggunakan underscore: gpon_, xgei_, gei_
          // ifDescr mungkin menggunakan dash: gpon-olt_
          
          // Untuk xgei dan gei, tampilkan format lengkap (xgei_1/10/1)
          const xgeiMatch = ifDescr.match(/xgei_(\d+\/\d+\/\d+)/i)
          if (xgeiMatch) {
            ports.push(xgeiMatch[0])
            continue
          }
          const geiMatch = ifDescr.match(/gei_(\d+\/\d+\/\d+)/i)
          if (geiMatch) {
            ports.push(geiMatch[0])
            continue
          }
          
          // Untuk gpon, ekstrak hanya bagian port (1/3/4)
          const portMatch = ifDescr.match(/gpon-olt_(\d+\/\d+\/\d+)/i) || 
                           ifDescr.match(/gpon_(\d+\/\d+\/\d+)/i) ||
                           ifDescr.match(/(\d+\/\d+\/\d+)/)
          if (portMatch) {
            ports.push(portMatch[1])
            continue
          } else {
            // Jika tidak match pattern, gunakan description as-is
            ports.push(ifDescr)
            continue
          }
        }
        
        // Jika tidak ada description, coba konversi interface index sebagai PON ID
        // Interface index di VLAN bitmap bisa berupa PON index yang perlu dikonversi
        
        // SEBELUM konversi PON index, coba sekali lagi cari interface description
        // dengan menggunakan semua interface yang tersedia
        if (!ifDescr || ifDescr.trim() === '') {
          // Coba cari interface berdasarkan bridgePortNumber dengan berbagai strategi
          // Strategi: Cari interface yang index-nya paling dekat dengan bridgePortNumber atau interfaceIndex
          let closestInterface: { idx: number; descr: string } | null = null
          let minDiff = Infinity
          
          for (const [idx, descr] of ifDescrMap.entries()) {
            if (descr && descr.trim() !== '') {
              // Hitung perbedaan antara interface index dengan bridgePortNumber atau interfaceIndex
              const diff1 = Math.abs(idx - bridgePortNumber)
              const diff2 = Math.abs(idx - interfaceIndex)
              const diff = Math.min(diff1, diff2)
              
              // Jika interface ini lebih dekat dan memiliki pola port yang valid
              if (diff < minDiff && (descr.match(/gpon|gei|xgei|pon/i))) {
                minDiff = diff
                closestInterface = { idx, descr }
              }
            }
          }
          
          // Jika ditemukan interface yang dekat, gunakan itu
          if (closestInterface && minDiff < 1000000) { // Threshold untuk memastikan tidak terlalu jauh
            ifDescr = closestInterface.descr
            interfaceIndex = closestInterface.idx
            
            // Extract port dari description yang ditemukan
            const xgeiMatch = ifDescr.match(/xgei_(\d+\/\d+\/\d+)/i)
            if (xgeiMatch) {
              ports.push(xgeiMatch[0])
              continue
            }
            const geiMatch = ifDescr.match(/gei_(\d+\/\d+\/\d+)/i)
            if (geiMatch) {
              ports.push(geiMatch[0])
              continue
            }
            const gponMatch = ifDescr.match(/gpon-olt_(\d+\/\d+\/\d+)/i) || 
                             ifDescr.match(/gpon_(\d+\/\d+\/\d+)/i) ||
                             ifDescr.match(/(\d+\/\d+\/\d+)/)
            if (gponMatch) {
              ports.push(gponMatch[1])
              continue
            }
          }
        }
        
        // Jika masih tidak ada description, coba konversi interface index sebagai PON ID
        // Coba metode 1: Rumus PONID = (Frame * 16777216) + (Slot * 65536) + (Port * 256)
        let convertedPort: string | null = null
        if (interfaceIndex >= 10000) {
          const portInfo1 = ponIdToFrameSlotPort(interfaceIndex)
          if (portInfo1) {
            convertedPort = `${portInfo1.frame}/${portInfo1.slot}/${portInfo1.port}`
          }
        }
        
        // Coba metode 2: Binary parsing (untuk PON index yang di-encode sebagai binary)
        if (!convertedPort) {
          const portStr = ponIndexToPort(interfaceIndex)
          if (portStr && !portStr.startsWith('INVALID')) {
            convertedPort = portStr
          }
        }
        
        // Coba metode 3: Jika interfaceIndex adalah bridgePortNumber (fallback), coba konversi sebagai PON ID
        if (!convertedPort && interfaceIndex === bridgePortNumber && interfaceIndex >= 10000) {
          const portInfo2 = ponIdToFrameSlotPort(interfaceIndex)
          if (portInfo2) {
            convertedPort = `${portInfo2.frame}/${portInfo2.slot}/${portInfo2.port}`
          }
        }
        
        // Jika berhasil konversi PON index, coba cari interface description yang cocok
        if (convertedPort) {
          // Coba cari interface description yang cocok dengan format port yang dikonversi
          // Format: gpon_1/9/13 atau gpon-olt_1/9/13
          const portPattern = convertedPort.replace(/\//g, '\\/') // Escape slash untuk regex
          const matchingInterfaces: Array<{ idx: number; descr: string }> = []
          
          for (const [idx, descr] of ifDescrMap.entries()) {
            if (descr && descr.trim() !== '') {
              // Cek apakah description mengandung port yang dikonversi
              // Format bisa: gpon_1/9/13, gpon-olt_1/9/13, atau hanya 1/9/13
              if (descr.includes(convertedPort)) {
                matchingInterfaces.push({ idx, descr })
              }
            }
          }
          
          // Jika ditemukan interface yang cocok, gunakan format interface description
          if (matchingInterfaces.length > 0) {
            // Pilih interface pertama yang cocok
            const selected = matchingInterfaces[0]
            const xgeiMatch = selected.descr.match(/xgei_(\d+\/\d+\/\d+)/i)
            if (xgeiMatch) {
              ports.push(xgeiMatch[0])
              continue
            }
            const geiMatch = selected.descr.match(/gei_(\d+\/\d+\/\d+)/i)
            if (geiMatch) {
              ports.push(geiMatch[0])
              continue
            }
            const gponMatch = selected.descr.match(/gpon-olt_(\d+\/\d+\/\d+)/i) || 
                             selected.descr.match(/gpon_(\d+\/\d+\/\d+)/i)
            if (gponMatch) {
              // Untuk GPON, ekstrak hanya bagian port (1/9/13)
              ports.push(gponMatch[1])
              continue
            }
          }
          
          // Jika tidak ditemukan interface yang cocok dengan exact match,
          // coba cari interface GPON yang memiliki slot/frame yang sama
          // Misalnya: jika convertedPort = 1/9/13, cari gpon_1/9/* atau gpon_1/*/13
          if (matchingInterfaces.length === 0) {
            const portParts = convertedPort.split('/')
            if (portParts.length === 3) {
              const [frame, slot, port] = portParts.map(p => parseInt(p))
              
              // Cari interface yang memiliki frame dan slot yang sama
              for (const [idx, descr] of ifDescrMap.entries()) {
                if (descr && descr.trim() !== '') {
                  const gponMatch = descr.match(/gpon_(\d+)\/(\d+)\/(\d+)/i) || 
                                   descr.match(/gpon-olt_(\d+)\/(\d+)\/(\d+)/i)
                  if (gponMatch) {
                    const descrFrame = parseInt(gponMatch[1])
                    const descrSlot = parseInt(gponMatch[2])
                    const descrPort = parseInt(gponMatch[3])
                    
                    // Jika frame dan slot sama, gunakan interface ini
                    if (descrFrame === frame && descrSlot === slot) {
                      // Gunakan port dari convertedPort, bukan dari description
                      ports.push(convertedPort)
                      continue
                    }
                  }
                }
              }
            }
          }
          
          // Jika tidak ditemukan interface yang cocok, gunakan format GPON yang sudah dikonversi
          ports.push(convertedPort)
          continue
        }
        
        // Coba metode 3: Jika bridgePortNumber bisa digunakan langsung sebagai interface index
        // Beberapa OLT menggunakan BRIDGE-MIB port number yang sama dengan IF-MIB interface index
        const directIfDescr = ifDescrMap.get(bridgePortNumber)
        if (directIfDescr && directIfDescr.trim() !== '') {
          const xgeiMatch = directIfDescr.match(/xgei_(\d+\/\d+\/\d+)/i)
          if (xgeiMatch) {
            ports.push(xgeiMatch[0])
            continue
          }
          const geiMatch = directIfDescr.match(/gei_(\d+\/\d+\/\d+)/i)
          if (geiMatch) {
            ports.push(geiMatch[0])
            continue
          }
          const gponMatch = directIfDescr.match(/gpon-olt_(\d+\/\d+\/\d+)/i) || 
                           directIfDescr.match(/gpon_(\d+\/\d+\/\d+)/i) ||
                           directIfDescr.match(/(\d+\/\d+\/\d+)/)
          if (gponMatch) {
            ports.push(gponMatch[1])
            continue
          }
        }
        
        // Jika semua metode gagal, coba konversi interfaceIndex sebagai PON ID sekali lagi
        // TAPI: Hanya jika interfaceIndex cukup besar dan masuk akal sebagai PON ID
        // Jangan konversi interface index kecil karena bisa menghasilkan hasil yang salah
        if (!convertedPort && interfaceIndex >= 16777216) {
          // Coba konversi dengan rumus PONID (hanya untuk nilai yang cukup besar)
          const portInfo3 = ponIdToFrameSlotPort(interfaceIndex)
          if (portInfo3) {
            convertedPort = `${portInfo3.frame}/${portInfo3.slot}/${portInfo3.port}`
            ports.push(convertedPort)
            continue
          }
          
          // Coba binary parsing (untuk PON index yang di-encode sebagai binary)
          const portStr2 = ponIndexToPort(interfaceIndex)
          if (portStr2 && !portStr2.startsWith('INVALID')) {
            ports.push(portStr2)
            continue
          }
        }
        
        // JANGAN gunakan bridgePortNumber sebagai PON ID karena bridge port number
        // biasanya kecil dan tidak menggunakan format PON ID
        // bridgePortNumber adalah BRIDGE-MIB port number, bukan PON ID
        
        // Jika masih tidak bisa, log warning tapi tetap tambahkan port number untuk debugging
        console.warn(`[VLAN-SNMP] Could not map bridge port ${bridgePortNumber} (interfaceIndex: ${interfaceIndex}) to any interface`)
        // Tampilkan sebagai bridge port number untuk debugging
        const finalPort = `Port-${bridgePortNumber}`
        ports.push(finalPort)
        portMappingLog.push({
          bridgePort: bridgePortNumber,
          ifIndex: interfaceIndex,
          ifDescr: null,
          result: finalPort
        })
        continue
      }
    }
  }
  
  // Log port mapping untuk debugging (hanya jika ada banyak port yang sama)
  const portCounts = new Map<string, number>()
  for (const port of ports) {
    portCounts.set(port, (portCounts.get(port) || 0) + 1)
  }
  
  // Jika ada port yang muncul lebih dari 3 kali, log warning
  for (const [port, count] of portCounts.entries()) {
    if (count > 3) {
      console.warn(`[VLAN-SNMP] Port ${port} appears ${count} times in bitmap - possible mapping issue`)
      // Log beberapa contoh mapping untuk port ini
      const examples = portMappingLog.filter(log => log.result === port).slice(0, 5)
      console.warn(`[VLAN-SNMP] Examples:`, examples.map(e => ({
        bridgePort: e.bridgePort,
        ifIndex: e.ifIndex,
        ifDescr: e.ifDescr
      })))
    }
  }
  
  return ports
}

// Build mapping interface index -> interface description/name
// Juga build mapping BRIDGE-MIB port number -> IF-MIB interface index
function buildIfDescrMap(ifDescrResults: Array<{ oid: string; value: any }>, ifNameResults: Array<{ oid: string; value: any }>): Map<number, string> {
  const map = new Map<number, string>()
  
  // Format OID: 1.3.6.1.2.1.2.2.1.2.INTERFACE_INDEX = STRING: "gpon-olt_1/3/4" atau "xgei_1/10/1"
  for (const result of ifDescrResults) {
    const oidParts = result.oid.split('.')
    if (oidParts.length > 0) {
      const interfaceIndex = parseInt(oidParts[oidParts.length - 1])
      if (!isNaN(interfaceIndex) && interfaceIndex > 0) {
        const description = result.value.toString().trim()
        if (description && description !== '') {
          map.set(interfaceIndex, description)
        }
      }
    }
  }
  
  // Format OID: 1.3.6.1.2.1.31.1.1.1.1.INTERFACE_INDEX = STRING: "xgei_1/10/1" atau "gpon_1/3/4"
  // ifName biasanya lebih akurat untuk ZTE
  for (const result of ifNameResults) {
    const oidParts = result.oid.split('.')
    if (oidParts.length > 0) {
      const interfaceIndex = parseInt(oidParts[oidParts.length - 1])
      if (!isNaN(interfaceIndex) && interfaceIndex > 0) {
        const name = result.value.toString().trim()
        if (name && name !== '') {
          // ifName lebih prioritas, jadi overwrite jika sudah ada
          map.set(interfaceIndex, name)
        }
      }
    }
  }
  
  return map
}

// Build mapping BRIDGE-MIB port number -> IF-MIB interface index
// BRIDGE-MIB menggunakan port number yang berbeda dari IF-MIB interface index
// Kita perlu menggunakan dot1dBasePortIfIndex (1.3.6.1.2.1.17.1.4.1.2) untuk mapping
// Tapi untuk sekarang, kita coba mapping langsung dari ifIndex
function buildBridgePortToIfIndexMap(ifIndexResults: Array<{ oid: string; value: any }>): Map<number, number> {
  const map = new Map<number, number>()
  
  // Format OID: 1.3.6.1.2.1.2.2.1.1.IF_INDEX = INTEGER: IF_INDEX
  // Ini adalah mapping port number (1-based) -> interface index
  // Port number di BRIDGE-MIB biasanya sama dengan interface index di IF-MIB untuk port yang sama
  // Tapi tidak selalu, jadi kita perlu mapping yang lebih akurat
  
  // Untuk sekarang, kita asumsikan port number = interface index
  // Tapi kita akan coba mapping dari dot1dBasePortIfIndex jika tersedia
  for (const result of ifIndexResults) {
    const oidParts = result.oid.split('.')
    if (oidParts.length > 0) {
      const ifIndex = parseInt(oidParts[oidParts.length - 1])
      const portNumber = parseInt(result.value.toString())
      if (!isNaN(ifIndex) && !isNaN(portNumber) && ifIndex > 0 && portNumber > 0) {
        // Port number di BRIDGE-MIB -> Interface index di IF-MIB
        map.set(portNumber, ifIndex)
      }
    }
  }
  
  return map
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

  // Cek SNMP connection status, tapi tetap coba ambil data jika kredensial tersedia
  if (!olt.snmpConnected) {
    console.log(`[VLAN-SNMP] Warning: SNMP status menunjukkan tidak connected untuk OLT ${olt.name}, tapi akan tetap mencoba mengambil data VLAN`)
  }

  if (!olt.snmpCommunityWrite) {
    return NextResponse.json(
      { 
        error: 'SNMP community tidak ditemukan di data OLT. Silakan edit OLT dan pastikan SNMP community sudah diisi dengan benar.',
        hint: 'Pastikan OLT sudah di-test connection terlebih dahulu untuk mengaktifkan SNMP connection.'
      },
      { status: 400 }
    )
  }

  try {
    console.log(`[VLAN-SNMP] Fetching VLAN data from OLT ${olt.name} (${olt.ipAddress}) via SNMP...`)

    // Walk semua OID VLAN secara paralel
    // 1. Standard BRIDGE-MIB OIDs (untuk kompatibilitas)
    // 2. ZTE-specific OIDs (dari dokumentasi ZTE-AN-VLAN-MIB.mib)
    const [
      // Standard BRIDGE-MIB
      vlanIdResults, 
      vlanNameResults, 
      vlanEgressResults, 
      vlanUntaggedResults, 
      ifDescrResults, 
      ifNameResults, 
      ifIndexResults, 
      dot1dBasePortIfIndexResults,
      // ZTE-specific OIDs
      zteL3IfNameResults,
      zteL3IfIndexResults,
      zteL3IfIpResults,
      zteL3IfMaskResults,
      zteVlanPortConfVlanIdResults,
    ] = await Promise.all([
      // Standard BRIDGE-MIB
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.vlanId, 30000).catch(() => []),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.vlanName, 30000).catch(() => []),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.vlanEgressPorts, 30000).catch(() => []),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.vlanUntaggedPorts, 30000).catch(() => []),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.ifDescr, 30000).catch(() => []),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.ifName, 30000).catch(() => []),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.ifIndex, 30000).catch(() => []),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.dot1dBasePortIfIndex, 30000).catch(() => []),
      // ZTE-specific OIDs
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.zteL3IfName, 30000).catch(() => []),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.zteL3IfIndex, 30000).catch(() => []),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.zteL3IfIp, 30000).catch(() => []),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.zteL3IfMask, 30000).catch(() => []),
      snmpWalk(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_VLAN_OIDS.zteVlanPortConfVlanId, 30000).catch(() => []),
    ])

    console.log(`[VLAN-SNMP] Standard BRIDGE-MIB Results:`)
    console.log(`  - Found ${vlanIdResults.length} VLAN IDs`)
    console.log(`  - Found ${vlanNameResults.length} VLAN Names`)
    console.log(`  - Found ${vlanEgressResults.length} Egress Port entries`)
    console.log(`  - Found ${vlanUntaggedResults.length} Untagged Port entries`)
    console.log(`  - Found ${ifDescrResults.length} Interface Descriptions`)
    console.log(`  - Found ${ifNameResults.length} Interface Names`)
    console.log(`  - Found ${ifIndexResults.length} Interface Indexes`)
    console.log(`  - Found ${dot1dBasePortIfIndexResults.length} BRIDGE-MIB port to IF-MIB interface index mappings`)
    
    console.log(`[VLAN-SNMP] ZTE-specific OIDs Results:`)
    console.log(`  - Found ${zteL3IfNameResults.length} ZTE L3 Interface Names (VLAN Interface Names)`)
    console.log(`  - Found ${zteL3IfIndexResults.length} ZTE L3 Interface Indexes`)
    console.log(`  - Found ${zteL3IfIpResults.length} ZTE L3 Interface IP Addresses`)
    console.log(`  - Found ${zteL3IfMaskResults.length} ZTE L3 Interface Subnet Masks`)
    console.log(`  - Found ${zteVlanPortConfVlanIdResults.length} ZTE VLAN Port Config VLAN IDs`)

    // Build interface description map untuk logging
    const ifDescrMap = buildIfDescrMap(ifDescrResults, ifNameResults)
    console.log(`[VLAN-SNMP] Interface descriptions found: ${ifDescrMap.size}`)
    
    // Log beberapa contoh interface untuk debugging
    if (ifDescrMap.size > 0) {
      const sampleInterfaces = Array.from(ifDescrMap.entries()).slice(0, 10)
      console.log(`[VLAN-SNMP] Sample interfaces:`, sampleInterfaces.map(([idx, descr]) => ({
        index: idx,
        description: descr
      })))
    }
    
    // Build bridge port to interface index mapping untuk logging
    const bridgePortToIfIndexMap = new Map<number, number>()
    for (const result of dot1dBasePortIfIndexResults) {
      const oidParts = result.oid.split('.')
      if (oidParts.length > 0) {
        const bridgePortNumber = parseInt(oidParts[oidParts.length - 1])
        const ifIndex = parseInt(result.value.toString())
        if (!isNaN(bridgePortNumber) && !isNaN(ifIndex) && bridgePortNumber > 0 && ifIndex > 0) {
          bridgePortToIfIndexMap.set(bridgePortNumber, ifIndex)
        }
      }
    }
    console.log(`[VLAN-SNMP] BRIDGE-MIB to IF-MIB mappings: ${bridgePortToIfIndexMap.size}`)
    if (bridgePortToIfIndexMap.size > 0) {
      const sampleMappings = Array.from(bridgePortToIfIndexMap.entries()).slice(0, 10)
      console.log(`[VLAN-SNMP] Sample mappings:`, sampleMappings.map(([bridgePort, ifIndex]) => ({
        bridgePort,
        ifIndex,
        ifDescr: ifDescrMap.get(ifIndex) || 'N/A'
      })))
    }

    // Parse VLAN data dengan logging lebih detail
    const vlanDetails = parseVlanFromSnmp(vlanIdResults, vlanNameResults, vlanEgressResults, vlanUntaggedResults, ifDescrResults, ifNameResults, ifIndexResults, dot1dBasePortIfIndexResults)

    console.log(`[VLAN-SNMP] Parsed ${vlanDetails.length} VLANs`)
    
    // Log detail mapping untuk debugging
    console.log(`[VLAN-SNMP] Bridge Port to IF-MIB Interface Index Mapping:`)
    const sampleMappings = Array.from(bridgePortToIfIndexMap.entries()).slice(0, 20)
    for (const [bridgePort, ifIndex] of sampleMappings) {
      const ifDescr = ifDescrMap.get(ifIndex) || 'N/A'
      console.log(`  Bridge Port ${bridgePort} -> IF-MIB Index ${ifIndex} (${ifDescr})`)
    }
    
    // Log detail untuk debugging port parsing
    if (vlanDetails.length > 0) {
      const vlanWithPorts = vlanDetails.filter(v => v.ports.length > 0)
      const vlanWithoutPorts = vlanDetails.filter(v => v.ports.length === 0)
      console.log(`[VLAN-SNMP] VLAN dengan ports: ${vlanWithPorts.length}, VLAN tanpa ports: ${vlanWithoutPorts.length}`)
      
      // Analisis format ports
      const portsWithInterfaceName = vlanWithPorts.filter(v => 
        v.ports.some(p => p.includes('xgei_') || p.includes('gei_') || p.includes('gpon_'))
      )
      const portsWithGponFormat = vlanWithPorts.filter(v => 
        v.ports.some(p => /^\d+\/\d+\/\d+$/.test(p) && !p.includes('xgei_') && !p.includes('gei_') && !p.includes('gpon_'))
      )
      
      console.log(`[VLAN-SNMP] VLAN dengan interface name (xgei/gei/gpon): ${portsWithInterfaceName.length}`)
      console.log(`[VLAN-SNMP] VLAN dengan format GPON (1/4/197): ${portsWithGponFormat.length}`)
      
      // Log beberapa contoh VLAN untuk debugging
      if (vlanWithPorts.length > 0) {
        console.log(`[VLAN-SNMP] Contoh VLAN dengan ports:`, vlanWithPorts.slice(0, 3).map(v => ({
          vlanId: v.vlanId,
          name: v.name,
          portCount: v.ports.length,
          samplePorts: v.ports.slice(0, 5),
          portFormats: {
            withInterfaceName: v.ports.filter(p => p.includes('xgei_') || p.includes('gei_') || p.includes('gpon_')).length,
            withGponFormat: v.ports.filter(p => /^\d+\/\d+\/\d+$/.test(p) && !p.includes('xgei_') && !p.includes('gei_') && !p.includes('gpon_')).length
          }
        })))
      }
    }

    return NextResponse.json({
      olt: {
        id: olt.id,
        name: olt.name,
        ipAddress: olt.ipAddress,
      },
      vlans: vlanDetails,
      total: vlanDetails.length,
      warning: !olt.snmpConnected ? 'SNMP status menunjukkan tidak connected, tapi data berhasil diambil. Silakan test connection untuk memperbarui status.' : undefined,
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

// Helper function untuk execute telnet command
async function executeTelnetCommand(
  ipAddress: string,
  port: number,
  username: string,
  password: string,
  command: string,
  timeout: number = 30000
): Promise<string> {
  let connection: any = null

  try {
    console.log(`[VLAN-Telnet] Connecting to ${ipAddress}:${port}...`)

    connection = new Telnet()

    const params = {
      host: ipAddress,
      port: port,
      negotiationMandatory: false,
      timeout: 20000,
      shellPrompt: /[#>]\s*$/,
      username: username,
      password: password,
      loginPrompt: /[Uu]sername[: ]*$/i,
      passwordPrompt: /[Pp]assword[: ]*$/i,
      irs: '\r\n',
      ors: '\r\n',
      echoLines: 0,
    }

    await connection.connect(params)
    console.log('[VLAN-Telnet] Connected, waiting for login...')

    await new Promise((r) => setTimeout(r, 1000))

    console.log('[VLAN-Telnet] Login completed, executing command...')

    let outputBuffer = ''
    connection.on('data', (data: Buffer) => {
      const text = data.toString()
      outputBuffer += text
    })

    console.log(`[VLAN-Telnet] Sending command: ${command}`)
    await connection.send(command + '\r\n')

    const startTime = Date.now()
    let pageCount = 0
    let lastOutputLength = 0
    let stableCount = 0

    while (true) {
      await new Promise((r) => setTimeout(r, 500))

      if (outputBuffer.length > lastOutputLength) {
        lastOutputLength = outputBuffer.length
        stableCount = 0
      } else {
        stableCount++
        if (stableCount >= 3) {
          break
        }
      }

      if (Date.now() - startTime > timeout) {
        break
      }

      if (outputBuffer.includes('More') || outputBuffer.includes('--More--')) {
        await connection.send(' ')
        pageCount++
        if (pageCount > 100) break
      }
    }

    await connection.end()
    console.log(`[VLAN-Telnet] Command executed, output length: ${outputBuffer.length}`)

    return outputBuffer
  } catch (error: any) {
    console.error('[VLAN-Telnet] Error:', error)
    if (connection) {
      try {
        await connection.end()
      } catch (e) {
        // Ignore
      }
    }
    throw error
  }
}

// DELETE endpoint untuk menghapus VLAN
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const vlanId = searchParams.get('vlanId')

  if (!vlanId) {
    return NextResponse.json({ error: 'VLAN ID diperlukan' }, { status: 400 })
  }

  const oltRepository = getOLTRepository()
  const olt = await oltRepository.findById(id)

  if (!olt) {
    return NextResponse.json({ error: 'OLT tidak ditemukan' }, { status: 404 })
  }

  if (!olt.telnetUsername || !olt.telnetPassword) {
    return NextResponse.json(
      { error: 'Telnet username dan password diperlukan untuk menghapus VLAN' },
      { status: 400 }
    )
  }

  try {
    console.log(`[VLAN-Delete] Deleting VLAN ${vlanId} from OLT ${olt.name} (${olt.ipAddress})...`)

    let connection: any = null

    try {
      connection = new Telnet()

      const params = {
        host: olt.ipAddress,
        port: olt.telnetPort,
        negotiationMandatory: false,
        timeout: 20000,
        shellPrompt: /[#>]\s*$/,
        username: olt.telnetUsername,
        password: olt.telnetPassword,
        loginPrompt: /[Uu]sername[: ]*$/i,
        passwordPrompt: /[Pp]assword[: ]*$/i,
        irs: '\r\n',
        ors: '\r\n',
        echoLines: 0,
      }

      await connection.connect(params)
      console.log('[VLAN-Delete] Connected, waiting for login...')

      await new Promise((r) => setTimeout(r, 1000))

      console.log('[VLAN-Delete] Login completed, executing command...')

      let outputBuffer = ''
      connection.on('data', (data: Buffer) => {
        const text = data.toString()
        outputBuffer += text
      })

      // Command untuk menghapus VLAN di ZTE OLT
      console.log(`[VLAN-Delete] Sending: no vlan ${vlanId}`)
      await connection.send(`no vlan ${vlanId}\r\n`)
      
      // Tunggu output
      await new Promise((r) => setTimeout(r, 2000))

      await connection.end()

      // Cek apakah command berhasil (tidak ada error message)
      if (outputBuffer.includes('Error') || outputBuffer.includes('Invalid') || outputBuffer.includes('Failed')) {
        return NextResponse.json(
          { error: `Gagal menghapus VLAN: ${outputBuffer}` },
          { status: 500 }
        )
      }

      console.log(`[VLAN-Delete] VLAN ${vlanId} berhasil dihapus`)

      return NextResponse.json({
        success: true,
        message: `VLAN ${vlanId} berhasil dihapus`,
      })
    } catch (error: any) {
      if (connection) {
        try {
          await connection.end()
        } catch (e) {
          // Ignore
        }
      }
      throw error
    }
  } catch (error: any) {
    console.error('[VLAN-Delete] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Gagal menghapus VLAN',
        details: error.toString(),
      },
      { status: 500 }
    )
  }
}

// PATCH endpoint untuk mengedit VLAN
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { vlanId, name, description } = body

  if (!vlanId) {
    return NextResponse.json({ error: 'VLAN ID diperlukan' }, { status: 400 })
  }

  if (!name && !description) {
    return NextResponse.json({ error: 'Name atau description diperlukan' }, { status: 400 })
  }

  const oltRepository = getOLTRepository()
  const olt = await oltRepository.findById(id)

  if (!olt) {
    return NextResponse.json({ error: 'OLT tidak ditemukan' }, { status: 404 })
  }

  if (!olt.telnetUsername || !olt.telnetPassword) {
    return NextResponse.json(
      { error: 'Telnet username dan password diperlukan untuk mengedit VLAN' },
      { status: 400 }
    )
  }

  try {
    console.log(`[VLAN-Edit] Editing VLAN ${vlanId} on OLT ${olt.name} (${olt.ipAddress})...`)

    let connection: any = null

    try {
      connection = new Telnet()

      const params = {
        host: olt.ipAddress,
        port: olt.telnetPort,
        negotiationMandatory: false,
        timeout: 20000,
        shellPrompt: /[#>]\s*$/,
        username: olt.telnetUsername,
        password: olt.telnetPassword,
        loginPrompt: /[Uu]sername[: ]*$/i,
        passwordPrompt: /[Pp]assword[: ]*$/i,
        irs: '\r\n',
        ors: '\r\n',
        echoLines: 0,
      }

      await connection.connect(params)
      console.log('[VLAN-Edit] Connected, waiting for login...')

      await new Promise((r) => setTimeout(r, 1000))

      console.log('[VLAN-Edit] Login completed, executing commands...')

      let outputBuffer = ''
      connection.on('data', (data: Buffer) => {
        const text = data.toString()
        outputBuffer += text
      })

      // Masuk ke konfigurasi VLAN
      console.log(`[VLAN-Edit] Sending: vlan ${vlanId}`)
      await connection.send(`vlan ${vlanId}\r\n`)
      await new Promise((r) => setTimeout(r, 1000))

      // Update name jika diberikan
      if (name) {
        console.log(`[VLAN-Edit] Sending: name ${name}`)
        await connection.send(`name ${name}\r\n`)
        await new Promise((r) => setTimeout(r, 1000))
      }

      // Update description jika diberikan
      if (description) {
        console.log(`[VLAN-Edit] Sending: description ${description}`)
        await connection.send(`description ${description}\r\n`)
        await new Promise((r) => setTimeout(r, 1000))
      }

      // Keluar dari konfigurasi VLAN
      console.log('[VLAN-Edit] Sending: exit')
      await connection.send('exit\r\n')
      await new Promise((r) => setTimeout(r, 1000))

      await connection.end()

      // Cek apakah command berhasil
      if (outputBuffer.includes('Error') || outputBuffer.includes('Invalid') || outputBuffer.includes('Failed')) {
        return NextResponse.json(
          { error: `Gagal mengedit VLAN: ${outputBuffer}` },
          { status: 500 }
        )
      }

      console.log(`[VLAN-Edit] VLAN ${vlanId} berhasil diupdate`)

      return NextResponse.json({
        success: true,
        message: `VLAN ${vlanId} berhasil diupdate`,
      })
    } catch (error: any) {
      if (connection) {
        try {
          await connection.end()
        } catch (e) {
          // Ignore
        }
      }
      throw error
    }
  } catch (error: any) {
    console.error('[VLAN-Edit] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Gagal mengedit VLAN',
        details: error.toString(),
      },
      { status: 500 }
    )
  }
}

