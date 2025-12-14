import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository, getOnuTypeRepository, getOnuRepository } from '@/lib/repositories'
import { Telnet } from 'telnet-client'
import snmp from 'net-snmp'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
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
    console.log(`[ONU-Type-Sync] Connecting to ${ipAddress}:${port}...`)

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
    console.log('[ONU-Type-Sync] Connected, waiting for login...')

    await new Promise((r) => setTimeout(r, 1000))

    console.log('[ONU-Type-Sync] Login completed, executing command...')

    let outputBuffer = ''
    connection.on('data', (data: Buffer) => {
      const text = data.toString()
      outputBuffer += text
    })

    console.log(`[ONU-Type-Sync] Sending command: ${command}`)
    await connection.send(command + '\r\n')

    const startTime = Date.now()
    let pageCount = 0
    let lastOutputLength = 0
    let stableCount = 0

    while (true) {
      await new Promise((r) => setTimeout(r, 500))

      if (/--More--/i.test(outputBuffer)) {
        pageCount++
        console.log(`[ONU-Type-Sync] Paging detected (page ${pageCount}), sending space...`)
        outputBuffer = outputBuffer.replace(/--More--/gi, '')
        await connection.send(' ')
        lastOutputLength = outputBuffer.length
        stableCount = 0
        continue
      }

      if (outputBuffer.length === lastOutputLength) {
        stableCount++
        if (stableCount >= 3) {
          if (/[A-Z0-9-]+[#>]\s*$/.test(outputBuffer) || /[#>]\s*$/.test(outputBuffer)) {
            console.log('[ONU-Type-Sync] Output complete')
            break
          }
        }
      } else {
        stableCount = 0
        lastOutputLength = outputBuffer.length
      }

      if (Date.now() - startTime > timeout) {
        console.warn('[ONU-Type-Sync] Timeout reached')
        break
      }
    }

    await connection.end()
    
    // Clean output: remove command echo dan prompt
    let cleanedOutput = outputBuffer
      .replace(new RegExp(`^.*${command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'm'), '')
      .replace(/[A-Z0-9-]+[#>]\s*$/m, '')
      .trim()

    return cleanedOutput
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
}

// Parse output dari "show onu-type"
function parseOnuTypeOutput(output: string): Array<{
  name: string
  ponType?: string
  description?: string
  maxTcont?: number
  maxGemPort?: number
  maxSwitchPerSlot?: number
  maxFlowPerSwitch?: number
  maxIpHost?: number
  maxIpv6Host?: number
  serviceAbilityN1?: string
  serviceAbility1M?: string
  serviceAbility1P?: string
  wifiMgmtViaNonOmci?: string
  omciSendMode?: string
  defaultMulticastRange?: string
  vrg?: string
  mgcConfigureMode?: string
  maxVeip?: number
  extendedOmci?: string
  location?: string
}> {
  const types: Array<any> = []
  const lines = output.split('\n')
  
  let currentType: any = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip empty lines
    if (!line) continue
    
    // Deteksi awal ONU type baru
    // Format: "ONU type name:          ALL"
    const nameMatch = line.match(/ONU type name:\s+(.+)/i)
    if (nameMatch) {
      // Simpan type sebelumnya jika ada
      if (currentType && currentType.name) {
        types.push(currentType)
      }
      
      // Mulai type baru
      currentType = {
        name: nameMatch[1].trim(),
      }
      continue
    }
    
    // Parse field lainnya
    if (currentType) {
      // PON type
      const ponTypeMatch = line.match(/PON type:\s+(.+)/i)
      if (ponTypeMatch) {
        currentType.ponType = ponTypeMatch[1].trim()
        continue
      }
      
      // Description
      const descMatch = line.match(/Description:\s+(.+)/i)
      if (descMatch) {
        currentType.description = descMatch[1].trim() || undefined
        continue
      }
      
      // Max T-CONT
      const maxTcontMatch = line.match(/Max T-CONT:\s+(\d+)/i)
      if (maxTcontMatch) {
        currentType.maxTcont = parseInt(maxTcontMatch[1])
        continue
      }
      
      // Max GEM port
      const maxGemPortMatch = line.match(/Max GEM port:\s+(\d+)/i)
      if (maxGemPortMatch) {
        currentType.maxGemPort = parseInt(maxGemPortMatch[1])
        continue
      }
      
      // Max switch per slot
      const maxSwitchMatch = line.match(/Max switch per slot:\s+(\d+)/i)
      if (maxSwitchMatch) {
        currentType.maxSwitchPerSlot = parseInt(maxSwitchMatch[1])
        continue
      }
      
      // Max flow per switch
      const maxFlowMatch = line.match(/Max flow per switch:\s+(\d+)/i)
      if (maxFlowMatch) {
        currentType.maxFlowPerSwitch = parseInt(maxFlowMatch[1])
        continue
      }
      
      // Max IP host
      const maxIpHostMatch = line.match(/Max IP host:\s+(\d+)/i)
      if (maxIpHostMatch) {
        currentType.maxIpHost = parseInt(maxIpHostMatch[1])
        continue
      }
      
      // Max IPv6 host
      const maxIpv6HostMatch = line.match(/Max IPv6 host:\s+(\d+)/i)
      if (maxIpv6HostMatch) {
        currentType.maxIpv6Host = parseInt(maxIpv6HostMatch[1])
        continue
      }
      
      // Service ability N:1
      const serviceN1Match = line.match(/Service ability N:1:\s+(.+)/i)
      if (serviceN1Match) {
        currentType.serviceAbilityN1 = serviceN1Match[1].trim()
        continue
      }
      
      // Service ability 1:M
      const service1MMatch = line.match(/Service ability 1:M:\s+(.+)/i)
      if (service1MMatch) {
        currentType.serviceAbility1M = service1MMatch[1].trim()
        continue
      }
      
      // Service ability 1:P
      const service1PMatch = line.match(/Service ability 1:P:\s+(.+)/i)
      if (service1PMatch) {
        currentType.serviceAbility1P = service1PMatch[1].trim()
        continue
      }
      
      // WIFI mgmt via non OMCI
      const wifiMgmtMatch = line.match(/WIFI mgmt via non OMCI:\s+(.+)/i)
      if (wifiMgmtMatch) {
        currentType.wifiMgmtViaNonOmci = wifiMgmtMatch[1].trim()
        continue
      }
      
      // OMCI send mode
      const omciSendModeMatch = line.match(/OMCI send mode:\s+(.+)/i)
      if (omciSendModeMatch) {
        currentType.omciSendMode = omciSendModeMatch[1].trim()
        continue
      }
      
      // Default multicast range
      const multicastRangeMatch = line.match(/Default multicast range:\s+(.+)/i)
      if (multicastRangeMatch) {
        currentType.defaultMulticastRange = multicastRangeMatch[1].trim()
        continue
      }
      
      // VRG
      const vrgMatch = line.match(/VRG:\s+(.+)/i)
      if (vrgMatch) {
        currentType.vrg = vrgMatch[1].trim()
        continue
      }
      
      // MGC configure mode
      const mgcModeMatch = line.match(/MGC configure mode:\s+(.+)/i)
      if (mgcModeMatch) {
        currentType.mgcConfigureMode = mgcModeMatch[1].trim()
        continue
      }
      
      // Max VEIP
      const maxVeipMatch = line.match(/Max VEIP:\s+(\d+)/i)
      if (maxVeipMatch) {
        currentType.maxVeip = parseInt(maxVeipMatch[1])
        continue
      }
      
      // Extended OMCI
      const extendedOmciMatch = line.match(/Extended OMCI:\s+(.+)/i)
      if (extendedOmciMatch) {
        currentType.extendedOmci = extendedOmciMatch[1].trim()
        continue
      }
      
      // Location
      const locationMatch = line.match(/Location:\s+(.+)/i)
      if (locationMatch) {
        currentType.location = locationMatch[1].trim()
        continue
      }
    }
  }
  
  // Simpan type terakhir jika ada
  if (currentType && currentType.name) {
    types.push(currentType)
  }
  
  return types
}

// Helper function untuk parse ONU type name dan extract info
// Contoh: "ZTE-F660", "H640GW", "HG8245H", dll
function parseOnuTypeInfo(typeName: string): { ethernetPorts: number; wifi: number; voipPorts: number } {
  // Default values
  let ethernetPorts = 0
  let wifi = 0
  let voipPorts = 0

  // Parse berdasarkan nama type yang umum
  const upperType = typeName.toUpperCase()
  
  // ZTE F660 - biasanya 4 Ethernet, 1 WiFi, 2 VoIP
  if (upperType.includes('F660')) {
    ethernetPorts = 4
    wifi = 1
    voipPorts = 2
  }
  // ZTE F601 - biasanya 1 Ethernet, 0 WiFi, 0 VoIP
  else if (upperType.includes('F601')) {
    ethernetPorts = 1
    wifi = 0
    voipPorts = 0
  }
  // H640GW - biasanya 4 Ethernet, 1 WiFi, 2 VoIP
  else if (upperType.includes('H640GW') || upperType.includes('H640')) {
    ethernetPorts = 4
    wifi = 1
    voipPorts = 2
  }
  // HG8245H - biasanya 4 Ethernet, 1 WiFi, 2 VoIP
  else if (upperType.includes('HG8245H') || upperType.includes('HG8245')) {
    ethernetPorts = 4
    wifi = 1
    voipPorts = 2
  }
  // HG8240 - biasanya 4 Ethernet, 1 WiFi, 2 VoIP
  else if (upperType.includes('HG8240')) {
    ethernetPorts = 4
    wifi = 1
    voipPorts = 2
  }
  // Default: coba tebak berdasarkan pattern
  else {
    // Jika ada "GW" biasanya ada WiFi
    if (upperType.includes('GW')) {
      wifi = 1
    }
    // Default 4 Ethernet ports untuk ONU yang tidak diketahui
    ethernetPorts = 4
  }

  return { ethernetPorts, wifi, voipPorts }
}

// SNMP OIDs untuk ONU Type (berdasarkan dokumentasi PDF dan implementasi)
// Berdasarkan penjelasan: OLT menggunakan branch 1.3.6.1.4.1.3902.1012 (GPON)
const SNMP_ONU_TYPE_OIDS = {
  // ONU Type/Model untuk GPON: .1.3.6.1.4.1.3902.1012.3.28.2.1.8.{PON}.{ONU_ID}
  // OID ini untuk mendapatkan ONU Type dari ONU yang terdaftar
  onuType: '1.3.6.1.4.1.3902.1012.3.28.2.1.8',
  // zxGponOntDevMgmtTable - ONU Device Management Table
  // Base OID: 1.3.6.1.4.1.3902.1012.3.28.1 (zxGponOntDevMgmtTable)
  // zxGponOntDevMgmtTypeName: .1.3.6.1.4.1.3902.1012.3.28.1.1.1.{composite_index}
  onuDevMgmtTypeName: '1.3.6.1.4.1.3902.1012.3.28.1.1.1',
  // zxGponOntDevMgmtTable base untuk walk semua ONU
  onuDevMgmtTable: '1.3.6.1.4.1.3902.1012.3.28.1',
  // ONU Type Name untuk C3XX: .1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.1
  onuTypeC3xx: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.1',
}

// Helper function untuk decode composite index (32-bit) ke slot/port
// Format Type 1: [Type(4bit)=1][Shelf(4bit)][Slot(8bit)][Port(8bit)][0x00]
function decodeCompositeIndex(index: number): { type: number; shelf: number; slot: number; port: number } | null {
  try {
    // Convert ke hex
    const hex = index.toString(16).padStart(8, '0')
    
    // Parse bytes
    const type = parseInt(hex.substring(0, 1), 16)
    const shelf = parseInt(hex.substring(1, 2), 16)
    const slot = parseInt(hex.substring(2, 4), 16)
    const port = parseInt(hex.substring(4, 6), 16)
    
    return { type, shelf, slot, port }
  } catch (error) {
    return null
  }
}

// Helper function untuk SNMP walk (robust version)
async function snmpWalk(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 60000
): Promise<Array<{ oid: string; value: any; type?: number }>> {
  return new Promise((resolve, reject) => {
    let resolved = false
    let session: any = null
    let timeoutId: NodeJS.Timeout | null = null
    let stableCheckTimeout: NodeJS.Timeout | null = null
    const results: Array<{ oid: string; value: any; type?: number }> = []
    let isClosing = false
    let lastResultCount = 0
    let stableCount = 0

    const finish = (error?: any) => {
      if (resolved) return
      resolved = true
      
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      
      if (stableCheckTimeout) {
        clearTimeout(stableCheckTimeout)
        stableCheckTimeout = null
      }
      
      isClosing = true
      
      if (session) {
        try {
          setTimeout(() => {
            try {
              if (typeof session.close === 'function') {
                session.close()
              }
            } catch (e) {
              // Ignore
            }
          }, 200)
        } catch (e) {
          // Ignore
        }
        session = null
      }
      
      if (error) {
        // Jika ada error tapi sudah ada results, return results saja
        if (results.length > 0) {
          console.log(`[ONU-Type-SNMP] SNMP walk completed with ${results.length} results despite error: ${error.message}`)
          resolve(results)
        } else {
          reject(error)
        }
      } else {
        resolve(results)
      }
    }

    try {
      let snmpVersion: 0 | 1 | undefined = 1 // Default: Version2c
      if (version === '1') {
        snmpVersion = 0 // Version1
      } else if (version === '3') {
        console.warn(`[ONU-Type-SNMP] SNMP v3 is not supported, using v2c instead`)
        snmpVersion = 1 // Fallback to Version2c
      }

      session = snmp.createSession(ipAddress, community, {
        port: port,
        version: snmpVersion,
        retries: 3,
        timeout: 10000,
      })

      console.log(`[ONU-Type-SNMP] SNMP session created for OID: ${oid}`)

      // Set timeout utama
      timeoutId = setTimeout(() => {
        if (!resolved) {
          if (results.length > 0) {
            // Jika sudah ada results, tunggu lebih lama untuk memastikan tidak ada data lagi
            console.log(`[ONU-Type-SNMP] SNMP walk timeout reached with ${results.length} results, waiting 10 seconds for more data...`)
            if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
            stableCheckTimeout = setTimeout(() => {
              if (!resolved && !isClosing) {
                console.log(`[ONU-Type-SNMP] SNMP walk completed with ${results.length} results (timeout reached, no more data after 10s wait)`)
                finish()
              }
            }, 10000)
          } else {
            // Jika tidak ada results sama sekali, tunggu juga
            console.log(`[ONU-Type-SNMP] SNMP walk timeout with no results, waiting 5 seconds before giving up...`)
            if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
            stableCheckTimeout = setTimeout(() => {
              if (!resolved && !isClosing && results.length === 0) {
                finish(new Error('SNMP walk timeout - no results'))
              }
            }, 5000)
          }
        }
      }, timeout)

      // Check untuk stabilitas results (jika tidak ada perubahan selama 3 detik, anggap selesai)
      const checkStability = () => {
        if (resolved || isClosing) return
        
        if (results.length === lastResultCount) {
          stableCount++
          if (stableCount >= 3) {
            // Tidak ada perubahan selama 3 detik, anggap walk selesai
            console.log(`[ONU-Type-SNMP] SNMP walk completed with ${results.length} results (stable for 3 seconds)`)
            finish()
            return
          }
        } else {
          stableCount = 0
          lastResultCount = results.length
        }
        
        // Check lagi setelah 1 detik
        if (!resolved && !isClosing) {
          setTimeout(checkStability, 1000)
        }
      }

      const processCallback = (error: any, varbinds: any[]) => {
        if (resolved || isClosing) return

        // Handle error - perbaiki logging error
        if (error) {
          let errorMsg = 'Unknown error'
          try {
            if (error instanceof Error) {
              errorMsg = error.message
            } else if (typeof error === 'string') {
              errorMsg = error
            } else if (error?.message) {
              errorMsg = error.message
            } else {
              errorMsg = JSON.stringify(error)
            }
          } catch (e) {
            errorMsg = String(error)
          }
          
          // Filter out known harmless errors dari net-snmp library
          if (errorMsg.includes('req.doneCb') || errorMsg.includes('doneCb is not a function')) {
            // Ini adalah bug internal dari net-snmp, ignore
            return
          }
          
          console.warn(`[ONU-Type-SNMP] SNMP walk callback error: ${errorMsg}, current results: ${results.length}`)
          
          // Jika error tapi sudah ada results, jangan langsung finish
          if (results.length > 0) {
            console.log(`[ONU-Type-SNMP] SNMP walk error but have ${results.length} results, waiting 5 seconds for more data...`)
            if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
            stableCheckTimeout = setTimeout(() => {
              if (!resolved && !isClosing) {
                console.log(`[ONU-Type-SNMP] SNMP walk completed with ${results.length} results (error occurred but results available after 5s wait)`)
                finish()
              }
            }, 5000)
          } else {
            // Jika tidak ada results sama sekali, tunggu sebentar juga
            if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
            stableCheckTimeout = setTimeout(() => {
              if (!resolved && !isClosing && results.length === 0) {
                finish(new Error(`SNMP walk failed: ${errorMsg}`))
              }
            }, 3000)
          }
          return
        }

        if (!varbinds || varbinds.length === 0) {
          // Tidak ada varbinds, check stability
          checkStability()
          return
        }

        // Reset stable count karena ada data baru
        stableCount = 0

        // Process varbinds
        for (const varbind of varbinds) {
          if (snmp.isVarbindError(varbind)) {
            if (varbind.type === snmp.ObjectType.EndOfMibView) {
              console.log(`[ONU-Type-SNMP] EndOfMibView reached, total results: ${results.length}`)
              finish()
              return
            }
            continue
          }

          // Convert Buffer to string jika perlu
          let value = varbind.value
          if (Buffer.isBuffer(value)) {
            try {
              value = value.toString('utf8')
            } catch (e) {
              value = value.toString()
            }
          }

          results.push({
            oid: varbind.oid.toString(),
            value: value,
            type: varbind.type,
          })
        }

        // Update last result count
        lastResultCount = results.length

        // Check stability setelah menerima data
        checkStability()
      }

      // Validasi OID sebelum dipanggil
      if (!oid || typeof oid !== 'string' || oid.trim() === '') {
        console.error(`[ONU-Type-SNMP] Invalid OID provided: ${oid}`)
        finish(new Error(`Invalid OID: ${oid}`))
        return
      }

      const oidString = String(oid).trim()
      console.log(`[ONU-Type-SNMP] Starting SNMP walk for OID: ${oidString}`)
      
      // Wrap callback untuk menangani error dengan lebih baik
      const wrappedCallback = (error: any, varbinds: any[]) => {
        try {
          // Log untuk debugging
          if (varbinds && varbinds.length > 0) {
            console.log(`[ONU-Type-SNMP] Received ${varbinds.length} varbinds in callback`)
          }
          processCallback(error, varbinds)
        } catch (callbackError: any) {
          console.error(`[ONU-Type-SNMP] Error in processCallback:`, callbackError?.message || String(callbackError))
          // Jangan reject promise jika sudah ada results
          if (results.length > 0) {
            console.log(`[ONU-Type-SNMP] Callback error but have ${results.length} results, continuing...`)
            checkStability()
          }
        }
      }
      
      try {
        session.subtree(oidString, wrappedCallback)
      } catch (subtreeError: any) {
        console.error(`[ONU-Type-SNMP] Error calling session.subtree:`, subtreeError?.message || String(subtreeError))
        finish(subtreeError)
        return
      }
      
      // Start stability check
      setTimeout(checkStability, 2000) // Mulai check setelah 2 detik
    } catch (error: any) {
      finish(error)
    }
  })
}

// Sync ONU Type dari SNMP berdasarkan dokumentasi PDF
// Menggunakan SNMP walk untuk mendapatkan ONU Type dari ONU yang terdaftar di OLT
// Mencoba beberapa OID:
// 1. .1.3.6.1.4.1.3902.1012.3.28.2.1.8.{PON}.{ONU_ID} - ONU Type dari ONU terdaftar
// 2. .1.3.6.1.4.1.3902.1012.3.28.1.1.1.{composite_index} - zxGponOntDevMgmtTypeName
async function syncOnuTypeFromSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltId: string
): Promise<Array<{ name: string; count: number }>> {
  try {
    console.log(`[ONU-Type-SNMP] Fetching ONU types from OLT via SNMP...`)
    
    const typeMap = new Map<string, number>()
    
    // Coba OID 1: ONU Type dari ONU yang terdaftar (.1.3.6.1.4.1.3902.1012.3.28.2.1.8)
    // OID ini biasanya tidak tersedia, jadi kita skip dulu dan langsung ke OID 2
    // try {
    //   console.log(`[ONU-Type-SNMP] Trying OID: ${SNMP_ONU_TYPE_OIDS.onuType}`)
    //   const typeResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_TYPE_OIDS.onuType, 90000)
    //   console.log(`[ONU-Type-SNMP] Found ${typeResults.length} entries from OID ${SNMP_ONU_TYPE_OIDS.onuType}`)
    //   
    //   for (const result of typeResults) {
    //     const typeName = result.value?.toString()?.trim()
    //     if (typeName && typeName.length > 0 && typeName !== '0' && typeName !== '') {
    //       const count = typeMap.get(typeName) || 0
    //       typeMap.set(typeName, count + 1)
    //     }
    //   }
    // } catch (error: any) {
    //   console.warn(`[ONU-Type-SNMP] OID ${SNMP_ONU_TYPE_OIDS.onuType} failed: ${error.message}`)
    // }
    
    // Coba OID 2: zxGponOntDevMgmtTypeName (.1.3.6.1.4.1.3902.1012.3.28.1.1.1)
    // Format OID: .1.3.6.1.4.1.3902.1012.3.28.1.1.1.{composite_index}.{onu_id}
    // Composite index: 268632320 = 0x10030100 = Type=1, Shelf=0, Slot=3, Port=1
    // ONU ID: 3, 4, 5, 7, 8, 9, 10, 11, 12, 14, 17, 18, 19, 20, 21, 22, 24, 26, 28, 29
    // OID ini yang paling reliable berdasarkan output script bash
    try {
      console.log(`[ONU-Type-SNMP] Trying OID: ${SNMP_ONU_TYPE_OIDS.onuDevMgmtTypeName}`)
      const devMgmtResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_TYPE_OIDS.onuDevMgmtTypeName, 90000)
      console.log(`[ONU-Type-SNMP] Found ${devMgmtResults.length} entries from OID ${SNMP_ONU_TYPE_OIDS.onuDevMgmtTypeName}`)
      
      for (const result of devMgmtResults) {
        const typeName = result.value?.toString()?.trim()
        // Filter out "ALL" karena itu bukan ONU Type spesifik
        if (typeName && typeName.length > 0 && typeName !== '0' && typeName !== '' && typeName.toUpperCase() !== 'ALL') {
          const count = typeMap.get(typeName) || 0
          typeMap.set(typeName, count + 1)
        }
      }
      
      if (typeMap.size > 0) {
        console.log(`[ONU-Type-SNMP] Successfully extracted ${typeMap.size} unique ONU types from zxGponOntDevMgmtTypeName`)
      }
    } catch (error: any) {
      console.warn(`[ONU-Type-SNMP] OID ${SNMP_ONU_TYPE_OIDS.onuDevMgmtTypeName} failed: ${error.message}`)
    }
    
    // Coba OID 3: zxGponOntDevMgmtTable base (walk seluruh tabel)
    if (typeMap.size === 0) {
      try {
        console.log(`[ONU-Type-SNMP] Trying OID: ${SNMP_ONU_TYPE_OIDS.onuDevMgmtTable}`)
        const tableResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_TYPE_OIDS.onuDevMgmtTable, 90000)
        console.log(`[ONU-Type-SNMP] Found ${tableResults.length} entries from OID ${SNMP_ONU_TYPE_OIDS.onuDevMgmtTable}`)
        
        // Parse hasil dari tabel - cari yang mengandung type name
        for (const result of tableResults) {
          const oid = result.oid
          const value = result.value?.toString()?.trim()
          
          // Cek apakah ini adalah type name field (biasanya di akhir OID ada .1.1.1 atau similar)
          if (value && value.length > 0 && value !== '0' && value !== '') {
            // Cek apakah OID mengandung pattern untuk type name
            // Biasanya: ...3.28.1.1.1.{index} untuk type name
            if (oid.includes('3.28.1.1.1') || oid.includes('3.28.1')) {
              // Coba decode index untuk validasi
              const oidParts = oid.split('.')
              const lastIndex = parseInt(oidParts[oidParts.length - 1])
              if (!isNaN(lastIndex)) {
                const decoded = decodeCompositeIndex(lastIndex)
                if (decoded) {
                  // Ini kemungkinan type name
                  const count = typeMap.get(value) || 0
                  typeMap.set(value, count + 1)
                }
              }
            }
          }
        }
      } catch (error: any) {
        console.warn(`[ONU-Type-SNMP] OID ${SNMP_ONU_TYPE_OIDS.onuDevMgmtTable} failed: ${error.message}`)
      }
    }
    
    const onuTypes: Array<{ name: string; count: number }> = []
    for (const [name, count] of typeMap.entries()) {
      onuTypes.push({ name, count })
    }
    
    console.log(`[ONU-Type-SNMP] Found ${onuTypes.length} unique ONU types:`, onuTypes.map(t => t.name).join(', '))
    
    // Jika tidak ada hasil dari SNMP walk, coba ambil dari database (ONU yang sudah terdaftar)
    if (onuTypes.length === 0) {
      console.log(`[ONU-Type-SNMP] No ONU types from SNMP walk, trying database...`)
      
      try {
        const onuRepository = getOnuRepository()
        const registeredOnus = await onuRepository.findByOltId(oltId)
        
        console.log(`[ONU-Type-SNMP] Found ${registeredOnus.length} registered ONUs in database`)
        
        // Group ONU Type berdasarkan actualType dari ONU yang terdaftar
        for (const onu of registeredOnus) {
          if (onu.actualType && onu.actualType.trim() && onu.actualType !== '0' && onu.actualType !== '') {
            const typeName = onu.actualType.trim()
            const count = typeMap.get(typeName) || 0
            typeMap.set(typeName, count + 1)
          }
        }
        
        // Update onuTypes dari typeMap
        onuTypes.length = 0
        for (const [name, count] of typeMap.entries()) {
          onuTypes.push({ name, count })
        }
        
        if (onuTypes.length > 0) {
          console.log(`[ONU-Type-SNMP] Found ${onuTypes.length} unique ONU types from database:`, onuTypes.map(t => t.name).join(', '))
        }
      } catch (dbError: any) {
        console.warn(`[ONU-Type-SNMP] Database lookup failed: ${dbError.message}`)
      }
    }
    
    if (onuTypes.length === 0) {
      console.warn(`[ONU-Type-SNMP] No ONU types found. This might mean:`)
      console.warn(`  - No ONUs are registered on the OLT`)
      console.warn(`  - The OID structure is different for this OLT model`)
      console.warn(`  - Try using Telnet sync instead for configured ONU types`)
      console.warn(`  - Or sync ONUs first to populate the database`)
    }
    
    return onuTypes
  } catch (error: any) {
    console.error(`[ONU-Type-SNMP] Error fetching ONU types via SNMP:`, error)
    throw error
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
    const { provider } = await params
  const oltRepository = getOLTRepository()
  const onuTypeRepository = getOnuTypeRepository()
  const olt = await oltRepository.findById(id)

  if (!olt) {
    return NextResponse.json({ error: 'OLT tidak ditemukan' }, { status: 404 })
  }

      const { id } = await params
    const { provider } = await params
// Cek method sync dari query parameter
  const { searchParams } = new URL(req.url)
  const syncMethod = searchParams.get('method') || 'telnet' // default: telnet

  // Sync dari SNMP
  if (syncMethod === 'snmp') {
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
      console.log(`[ONU-Type-Sync] Fetching ONU types from OLT ${olt.name} (${olt.ipAddress}) via SNMP...`)

      // Get ONU types dari SNMP
      const onuTypesFromSNMP = await syncOnuTypeFromSNMP(
        olt.ipAddress,
        olt.snmpPort,
        olt.snmpCommunityWrite,
        olt.snmpVersion,
        olt.id
      )

      if (onuTypesFromSNMP.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Tidak ada ONU type ditemukan dari SNMP. Pastikan ada ONU yang terdaftar di OLT.',
          data: {
            totalTypes: 0,
            syncedTypes: 0,
            types: [],
          },
        })
      }

      // Sync ke database
      const syncedTypes: Array<{ name: string }> = []
      const errors: string[] = []

      for (const onuType of onuTypesFromSNMP) {
        try {
          // Helper function untuk parse ONU type name dan extract info
          function parseOnuTypeInfo(typeName: string): { ethernetPorts: number; wifi: number; voipPorts: number } {
            const upperType = typeName.toUpperCase()
            let ethernetPorts = 4
            let wifi = 0
            let voipPorts = 0

            if (upperType.includes('F660')) {
              ethernetPorts = 4
              wifi = 1
              voipPorts = 2
            } else if (upperType.includes('F601')) {
              ethernetPorts = 1
              wifi = 0
              voipPorts = 0
            } else if (upperType.includes('H640GW') || upperType.includes('H640')) {
              ethernetPorts = 4
              wifi = 1
              voipPorts = 2
            } else if (upperType.includes('HG8245H') || upperType.includes('HG8245')) {
              ethernetPorts = 4
              wifi = 1
              voipPorts = 2
            } else if (upperType.includes('HG8240')) {
              ethernetPorts = 4
              wifi = 1
              voipPorts = 2
            } else if (upperType.includes('GW')) {
              wifi = 1
            }

            return { ethernetPorts, wifi, voipPorts }
          }

          const typeInfo = parseOnuTypeInfo(onuType.name)

          // Cek apakah sudah ada
          const existingTypes = await onuTypeRepository.findByOltId(olt.id)
          const existing = existingTypes.find(t => t.name === onuType.name)

          if (existing) {
            // Update dengan data dari SNMP (hanya basic info karena SNMP tidak punya detail lengkap)
            await onuTypeRepository.update(existing.id, {
              ethernetPorts: typeInfo.ethernetPorts,
              wifi: typeInfo.wifi,
              voipPorts: typeInfo.voipPorts,
            })
            syncedTypes.push({ name: onuType.name })
          } else {
            // Create baru dengan data dari SNMP
            await onuTypeRepository.create({
              oltId: olt.id,
              name: onuType.name,
              ethernetPorts: typeInfo.ethernetPorts,
              wifi: typeInfo.wifi,
              voipPorts: typeInfo.voipPorts,
            })
            syncedTypes.push({ name: onuType.name })
          }
        } catch (error: any) {
          console.error(`[ONU-Type-Sync] Error syncing type ${onuType.name}:`, error)
          errors.push(`${onuType.name}: ${error.message}`)
        }
      }

      return NextResponse.json({
        success: true,
        message: `Berhasil sync ${syncedTypes.length} ONU types dari SNMP`,
        data: {
          totalTypes: onuTypesFromSNMP.length,
          syncedTypes: syncedTypes.length,
          types: syncedTypes.map(t => t.name),
          errors: errors.length > 0 ? errors : undefined,
        },
      })
    } catch (error: any) {
      console.error('[ONU-Type-Sync] Error:', error)
      return NextResponse.json(
        {
          error: error.message || 'Gagal sync ONU types dari SNMP',
          details: error.toString(),
        },
        { status: 500 }
      )
    }
  }

  // Sync dari Telnet (default)
  if (!olt.telnetConnected) {
    return NextResponse.json(
      { error: 'Telnet tidak connected. Silakan test connection terlebih dahulu.' },
      { status: 400 }
    )
  }

  if (!olt.telnetUsername || !olt.telnetPassword) {
    return NextResponse.json(
      { error: 'Username atau password Telnet tidak ditemukan di data OLT.' },
      { status: 400 }
    )
  }

  try {
    console.log(`[ONU-Type-Sync] Fetching ONU types from OLT ${olt.name} (${olt.ipAddress}) via Telnet...`)

    // Execute command "show onu-type" via Telnet
    const command = 'show onu-type'
    const output = await executeTelnetCommand(
      olt.ipAddress,
      olt.telnetPort,
      olt.telnetUsername,
      olt.telnetPassword,
      command,
      45000
    )

    console.log(`[ONU-Type-Sync] Command output length: ${output.length} characters`)

    // Parse output
    const onuTypes = parseOnuTypeOutput(output)
    console.log(`[ONU-Type-Sync] Parsed ${onuTypes.length} ONU types`)

    // Helper function untuk parse ONU type name dan extract info (untuk ethernetPorts, wifi, voipPorts)
    function parseOnuTypeInfo(typeName: string): { ethernetPorts: number; wifi: number; voipPorts: number } {
      const upperType = typeName.toUpperCase()
      let ethernetPorts = 4
      let wifi = 0
      let voipPorts = 0

      if (upperType.includes('F660')) {
        ethernetPorts = 4
        wifi = 1
        voipPorts = 2
      } else if (upperType.includes('F601')) {
        ethernetPorts = 1
        wifi = 0
        voipPorts = 0
      } else if (upperType.includes('H640GW') || upperType.includes('H640')) {
        ethernetPorts = 4
        wifi = 1
        voipPorts = 2
      } else if (upperType.includes('HG8245H') || upperType.includes('HG8245')) {
        ethernetPorts = 4
        wifi = 1
        voipPorts = 2
      } else if (upperType.includes('HG8240')) {
        ethernetPorts = 4
        wifi = 1
        voipPorts = 2
      } else if (upperType.includes('GW')) {
        wifi = 1
      }

      return { ethernetPorts, wifi, voipPorts }
    }

    // Sync ke database
    const syncedTypes: Array<{ name: string }> = []
    const errors: string[] = []

    for (const onuType of onuTypes) {
      try {
        // Parse ethernetPorts, wifi, voipPorts dari nama type
        const typeInfo = parseOnuTypeInfo(onuType.name)

        // Cek apakah sudah ada
        const existingTypes = await onuTypeRepository.findByOltId(olt.id)
        const existing = existingTypes.find(t => t.name === onuType.name)

        if (existing) {
          // Update dengan data lengkap
          await onuTypeRepository.update(existing.id, {
            ethernetPorts: typeInfo.ethernetPorts,
            wifi: typeInfo.wifi,
            voipPorts: typeInfo.voipPorts,
            ponType: onuType.ponType,
            description: onuType.description,
            maxTcont: onuType.maxTcont,
            maxGemPort: onuType.maxGemPort,
            maxSwitchPerSlot: onuType.maxSwitchPerSlot,
            maxFlowPerSwitch: onuType.maxFlowPerSwitch,
            maxIpHost: onuType.maxIpHost,
            maxIpv6Host: onuType.maxIpv6Host,
            serviceAbilityN1: onuType.serviceAbilityN1,
            serviceAbility1M: onuType.serviceAbility1M,
            serviceAbility1P: onuType.serviceAbility1P,
            wifiMgmtViaNonOmci: onuType.wifiMgmtViaNonOmci,
            omciSendMode: onuType.omciSendMode,
            defaultMulticastRange: onuType.defaultMulticastRange,
            vrg: onuType.vrg,
            mgcConfigureMode: onuType.mgcConfigureMode,
            maxVeip: onuType.maxVeip,
            extendedOmci: onuType.extendedOmci,
            location: onuType.location,
          })
          syncedTypes.push({ name: onuType.name })
        } else {
          // Create baru dengan data lengkap
          await onuTypeRepository.create({
            oltId: olt.id,
            name: onuType.name,
            ethernetPorts: typeInfo.ethernetPorts,
            wifi: typeInfo.wifi,
            voipPorts: typeInfo.voipPorts,
            ponType: onuType.ponType,
            description: onuType.description,
            maxTcont: onuType.maxTcont,
            maxGemPort: onuType.maxGemPort,
            maxSwitchPerSlot: onuType.maxSwitchPerSlot,
            maxFlowPerSwitch: onuType.maxFlowPerSwitch,
            maxIpHost: onuType.maxIpHost,
            maxIpv6Host: onuType.maxIpv6Host,
            serviceAbilityN1: onuType.serviceAbilityN1,
            serviceAbility1M: onuType.serviceAbility1M,
            serviceAbility1P: onuType.serviceAbility1P,
            wifiMgmtViaNonOmci: onuType.wifiMgmtViaNonOmci,
            omciSendMode: onuType.omciSendMode,
            defaultMulticastRange: onuType.defaultMulticastRange,
            vrg: onuType.vrg,
            mgcConfigureMode: onuType.mgcConfigureMode,
            maxVeip: onuType.maxVeip,
            extendedOmci: onuType.extendedOmci,
            location: onuType.location,
          })
          syncedTypes.push({ name: onuType.name })
        }
      } catch (error: any) {
        console.error(`[ONU-Type-Sync] Error syncing type ${onuType.name}:`, error)
        errors.push(`${onuType.name}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil sync ${syncedTypes.length} ONU types dari Telnet`,
      data: {
        totalTypes: onuTypes.length,
        syncedTypes: syncedTypes.length,
        types: syncedTypes.map(t => t.name),
        errors: errors.length > 0 ? errors : undefined,
      },
    })
  } catch (error: any) {
    console.error('[ONU-Type-Sync] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Gagal sync ONU types dari Telnet',
        details: error.toString(),
      },
      { status: 500 }
    )
  }
}

