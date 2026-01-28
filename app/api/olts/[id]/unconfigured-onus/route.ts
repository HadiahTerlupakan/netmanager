import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import { Telnet } from 'telnet-client'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

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
    console.log(`[ONU] Connecting to ${ipAddress}:${port}...`)

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
    console.log('[ONU] Connected, waiting for login...')

    await new Promise((r) => setTimeout(r, 1000))

    console.log('[ONU] Login completed, executing command...')

    let outputBuffer = ''
    connection.on('data', (data: Buffer) => {
      const text = data.toString()
      outputBuffer += text
      console.log(`[ONU] Data received: ${text.length} chars`)
    })

    console.log(`[ONU] Sending command: ${command}`)
    await connection.send(command + '\r\n')

    let pageCount = 0
    let lastOutputLength = 0
    let stableCount = 0

    while (true) {
      await new Promise((r) => setTimeout(r, 500))

      if (/--More--/i.test(outputBuffer)) {
        pageCount++
        console.log(`[ONU] Paging detected (page ${pageCount}), sending space...`)
        
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
            console.log('[ONU] Output complete, prompt detected')
            break
          }
        }
      } else {
        stableCount = 0
        lastOutputLength = outputBuffer.length
      }

      if (pageCount > 100 || outputBuffer.length > 5_000_000) {
        console.warn('[ONU] Safety limit reached')
        break
      }
    }

    const accumulated = outputBuffer
    console.log(`[ONU] Command completed, total output: ${accumulated.length} chars`)

    const cleaned = accumulated
      .replace(/--More--/gi, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')

    const lines = cleaned.split('\n')
    let startIdx = -1
    let endIdx = -1

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().includes(command)) {
        startIdx = i + 1
        break
      }
    }

    for (let i = lines.length - 1; i >= 0; i--) {
      if (/[A-Z0-9-]+[#>]\s*$/.test(lines[i]) || /[#>]\s*$/.test(lines[i])) {
        endIdx = i
        break
      }
    }

    let result = cleaned
    if (startIdx >= 0 && endIdx > startIdx) {
      result = lines.slice(startIdx, endIdx).join('\n').trim()
    } else if (cleaned.includes(command)) {
      const cmdPos = cleaned.indexOf(command)
      if (cmdPos >= 0) {
        const afterCmd = cleaned.substring(cmdPos + command.length)
        result = afterCmd.split(/[A-Z0-9-]+[#>]\s*$/m)[0].trim() || afterCmd.split(/[#>]\s*$/m)[0].trim()
      }
    }

    console.log(`[ONU] Final output: ${result.length} chars`)
    console.log(`[ONU] Preview: ${result.substring(0, 500)}`)

    connection.end()

    return result
  } catch (error: any) {
    console.error('[ONU] Error:', error)
    if (connection) {
      try {
        connection.end()
      } catch (e) {
        // Ignore
      }
    }
    throw error
  }
}

function detectModelFromSerial(serialNumber: string): string {
  const upperSerial = serialNumber.toUpperCase()
  
  if (upperSerial.startsWith('RTEGC') || upperSerial.startsWith('ZTEGC')) {
    return 'ZTE-ONU'
  } else if (upperSerial.startsWith('HWTC') || upperSerial.startsWith('FHTT')) {
    return 'Huawei-ONU'
  }
  
  return 'Unknown'
}

function parseUnconfiguredOnus(output: string): Array<{ id: string; model: string; serialNumber: string; port: string }> {
  const onus: Array<{ id: string; model: string; serialNumber: string; port: string }> = []
  const lines = output.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)

  let onuIndex = 1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.includes('OnuIndex') || line.includes('Sn') || line.includes('State') || line.match(/^-+$/)) {
      continue
    }

    const onuMatch = line.match(/gpon-onu_(\d+\/\d+\/\d+):(\d+)\s+([A-Z0-9]{12,})\s+(\w+)/)
    if (onuMatch) {
      const port = onuMatch[1]
      const serialNumber = onuMatch[3]
      const detectedModel = detectModelFromSerial(serialNumber)

      onus.push({
        id: `onu-${onuIndex++}`,
        model: detectedModel,
        serialNumber,
        port: port,
      })
      continue
    }

    const altMatch = line.match(/(\d+\/\d+\/\d+):(\d+)\s+([A-Z0-9]{12,})\s+(\w+)/)
    if (altMatch) {
      const port = altMatch[1]
      const serialNumber = altMatch[3]
      const detectedModel = detectModelFromSerial(serialNumber)

      onus.push({
        id: `onu-${onuIndex++}`,
        model: detectedModel,
        serialNumber,
        port: port,
      })
    }
  }

  return onus
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return ApiErrors.unauthorized('Session tidak valid')

  const { id } = await params
  const oltRepository = getOLTRepository()
  const olt = await oltRepository.findById(id)

  if (!olt) {
    return ApiErrors.notFound('OLT')
  }
  if (!olt.telnetConnected) {
    return apiError('Telnet tidak connected. Silakan test connection terlebih dahulu.', ErrorCodes.VALIDATION_ERROR, { status: 400 })
  }

  try {
    if (!olt.telnetUsername || !olt.telnetPassword) {
      return apiError('Username atau password Telnet tidak ditemukan di data OLT. Silakan update konfigurasi OLT terlebih dahulu.', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const command = 'show gpon onu uncfg'
    console.log(`[ONU] Executing command on OLT ${olt.name} (${olt.ipAddress}): ${command}`)
    console.log(`[ONU] Using Telnet credentials from OLT: username=${olt.telnetUsername}, port=${olt.telnetPort}`)
    
    const output = await executeTelnetCommand(
      olt.ipAddress,
      olt.telnetPort,
      olt.telnetUsername,
      olt.telnetPassword,
      command,
      45000
    )

    console.log(`[ONU] Command output length: ${output.length} characters`)
    console.log(`[ONU] Output preview: ${output.substring(0, 200)}...`)

    const unconfiguredOnus = parseUnconfiguredOnus(output)
    console.log(`[ONU] Parsed ${unconfiguredOnus.length} unconfigured ONUs`)

    return apiSuccess({
      olt: {
        id: olt.id,
        name: olt.name,
        ipAddress: olt.ipAddress,
      },
      unconfiguredOnus,
      rawOutput: output.substring(0, 5000),
    })
  } catch (error: any) {
    console.error('[ONU] Error fetching unconfigured ONUs:', error)
    console.error('[ONU] Error stack:', error.stack)
    return ApiErrors.internalError(error.message || 'Gagal memuat unconfigured ONU')
  }
}
