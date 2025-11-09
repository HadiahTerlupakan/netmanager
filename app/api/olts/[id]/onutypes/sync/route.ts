import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository, getOnuTypeRepository } from '@/lib/repositories'
import { Telnet } from 'telnet-client'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const oltRepository = getOLTRepository()
  const onuTypeRepository = getOnuTypeRepository()
  const olt = await oltRepository.findById(id)

  if (!olt) {
    return NextResponse.json({ error: 'OLT tidak ditemukan' }, { status: 404 })
  }

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

