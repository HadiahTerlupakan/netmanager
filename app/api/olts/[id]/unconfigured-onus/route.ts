import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import { Telnet } from 'telnet-client'

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
      // Prompt umum OLT ZTE: bisa '>' atau '#' dengan atau tanpa hostname
      shellPrompt: /[#>]\s*$/,
      username: username,
      password: password,
      loginPrompt: /[Uu]sername[: ]*$/i,
      passwordPrompt: /[Pp]assword[: ]*$/i,
      irs: '\r\n',
      ors: '\r\n',
      echoLines: 0,
    }

    // Connect
    await connection.connect(params)
    console.log('[ONU] Connected, waiting for login...')

    // Tunggu sebentar untuk memastikan login selesai
    await new Promise((r) => setTimeout(r, 1000))

    console.log('[ONU] Login completed, executing command...')

    // Gunakan exec() untuk menjalankan command dan mendapatkan output
    let accumulated = ''
    let outputBuffer = ''
    let commandExecuted = false

    // Setup event handler untuk menangkap output
    connection.on('data', (data: Buffer) => {
      const text = data.toString()
      outputBuffer += text
      console.log(`[ONU] Data received: ${text.length} chars`)
    })

    // Kirim command
    console.log(`[ONU] Sending command: ${command}`)
    await connection.send(command + '\r\n')
    commandExecuted = true

    // Tunggu output dan tangani paging
    let pageCount = 0
    let lastOutputLength = 0
    let stableCount = 0

    // Loop untuk menunggu output dan menangani paging
    while (true) {
      await new Promise((r) => setTimeout(r, 500))

      // Cek apakah ada --More-- di output
      if (/--More--/i.test(outputBuffer)) {
        pageCount++
        console.log(`[ONU] Paging detected (page ${pageCount}), sending space...`)
        
        // Hapus --More-- dari buffer
        outputBuffer = outputBuffer.replace(/--More--/gi, '')
        
        // Kirim spasi untuk lanjutkan
        await connection.send(' ')
        
        // Reset counter
        lastOutputLength = outputBuffer.length
        stableCount = 0
        continue
      }

      // Cek apakah output sudah stabil (tidak bertambah lagi)
      if (outputBuffer.length === lastOutputLength) {
        stableCount++
        // Jika output tidak berubah selama 3 iterasi (1.5 detik), kemungkinan sudah selesai
        if (stableCount >= 3) {
          // Cek apakah ada prompt di akhir output
          if (/[A-Z0-9-]+[#>]\s*$/.test(outputBuffer) || /[#>]\s*$/.test(outputBuffer)) {
            console.log('[ONU] Output complete, prompt detected')
            break
          }
        }
      } else {
        stableCount = 0
        lastOutputLength = outputBuffer.length
      }

      // Safety: timeout setelah 30 detik
      if (pageCount > 100 || outputBuffer.length > 5_000_000) {
        console.warn('[ONU] Safety limit reached')
        break
      }
    }

    accumulated = outputBuffer
    console.log(`[ONU] Command completed, total output: ${accumulated.length} chars`)

    // Bersihkan control chars: hapus semua '--More--' sequences
    const cleaned = accumulated
      .replace(/--More--/gi, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')

    // Extract hanya output command (hapus command dan prompt terakhir)
    const lines = cleaned.split('\n')
    let startIdx = -1
    let endIdx = -1

    // Cari baris command
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().includes(command)) {
        startIdx = i + 1
        break
      }
    }

    // Cari prompt terakhir (bisa dengan atau tanpa hostname)
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
      // Fallback: ambil setelah command
      const cmdPos = cleaned.indexOf(command)
      if (cmdPos >= 0) {
        const afterCmd = cleaned.substring(cmdPos + command.length)
        result = afterCmd.split(/[A-Z0-9-]+[#>]\s*$/m)[0].trim() || afterCmd.split(/[#>]\s*$/m)[0].trim()
      }
    }

    console.log(`[ONU] Final output: ${result.length} chars`)
    console.log(`[ONU] Preview: ${result.substring(0, 500)}`)

    // Close connection
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

// Fungsi untuk mendeteksi model dari serial number (jika ada pola)
function detectModelFromSerial(serialNumber: string): string {
  // Pola serial number vendor umum:
  // ZTE: RTEGC, ZTEGC -> biasanya F660, F609, dll
  // Huawei: HWTC, FHTT -> biasanya HG8245, HG8145, HG6243, dll
  
  const upperSerial = serialNumber.toUpperCase()
  
  if (upperSerial.startsWith('RTEGC') || upperSerial.startsWith('ZTEGC')) {
    // ZTE ONU - bisa F660, F609, dll
    // Tidak bisa deteksi model spesifik dari serial saja
    return 'ZTE-ONU'
  } else if (upperSerial.startsWith('HWTC') || upperSerial.startsWith('FHTT')) {
    // Huawei ONU - bisa HG8245, HG8145, HG6243, HG6145, dll
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

    // Skip header dan separator
    if (line.includes('OnuIndex') || line.includes('Sn') || line.includes('State') || line.match(/^-+$/)) {
      continue
    }

    // Format: gpon-onu_1/3/1:1         RTEGC6099704        unknown
    // atau: gpon-onu_1/3/14:1        HWTC284F63A3        unknown
    const onuMatch = line.match(/gpon-onu_(\d+\/\d+\/\d+):(\d+)\s+([A-Z0-9]{12,})\s+(\w+)/)
    if (onuMatch) {
      const port = onuMatch[1] // 1/3/1
      const onuId = onuMatch[2] // 1
      const serialNumber = onuMatch[3] // RTEGC6099704
      const state = onuMatch[4] // unknown

      // Deteksi model dari serial number
      const detectedModel = detectModelFromSerial(serialNumber)

      onus.push({
        id: `onu-${onuIndex++}`,
        model: detectedModel, // Deteksi dari serial number
        serialNumber,
        port: port, // Format: 1/3/1
      })
      continue
    }

    // Alternatif format tanpa prefix gpon-onu_
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
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
    const { provider } = await params
  const oltRepository = getOLTRepository()
  const olt = await oltRepository.findById(id)

  if (!olt) {
    return NextResponse.json({ error: 'OLT tidak ditemukan' }, { status: 404 })
  }

      const { id } = await params
    const { provider } = await params
if (!olt.telnetConnected) {
    return NextResponse.json(
      { error: 'Telnet tidak connected. Silakan test connection terlebih dahulu.' },
      { status: 400 }
    )
  }

  try {
    // Validasi data OLT
    if (!olt.telnetUsername || !olt.telnetPassword) {
      return NextResponse.json(
        { error: 'Username atau password Telnet tidak ditemukan di data OLT. Silakan update konfigurasi OLT terlebih dahulu.' },
        { status: 400 }
      )
    }

    // Execute command "show gpon onu uncfg" via Telnet
    const command = 'show gpon onu uncfg'
    console.log(`[ONU] Executing command on OLT ${olt.name} (${olt.ipAddress}): ${command}`)
    console.log(`[ONU] Using Telnet credentials from OLT: username=${olt.telnetUsername}, port=${olt.telnetPort}`)
    
    const output = await executeTelnetCommand(
      olt.ipAddress,
      olt.telnetPort,
      olt.telnetUsername,
      olt.telnetPassword,
      command,
      45000 // Increase timeout to 45 seconds
    )

    console.log(`[ONU] Command output length: ${output.length} characters`)
    console.log(`[ONU] Output preview: ${output.substring(0, 200)}...`)

    // Parse output untuk mendapatkan daftar ONU
    const unconfiguredOnus = parseUnconfiguredOnus(output)
    console.log(`[ONU] Parsed ${unconfiguredOnus.length} unconfigured ONUs`)

    return NextResponse.json({
      olt: {
        id: olt.id,
        name: olt.name,
        ipAddress: olt.ipAddress,
      },
      unconfiguredOnus,
      rawOutput: output.substring(0, 5000), // Limit raw output for debugging (first 5000 chars)
    })
  } catch (error: any) {
    console.error('[ONU] Error fetching unconfigured ONUs:', error)
    console.error('[ONU] Error stack:', error.stack)
    return NextResponse.json(
      {
        error: error.message || 'Gagal memuat unconfigured ONU',
        details: error.toString(),
      },
      { status: 500 }
    )
  }
}

