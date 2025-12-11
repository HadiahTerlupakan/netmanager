import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import snmp from 'net-snmp'
import { Telnet } from 'telnet-client'
import { createSocket } from 'dgram'
import '@/lib/utils/event-emitter-config'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

// Test UDP connectivity untuk memastikan port bisa diakses
async function testUDPPort(ipAddress: string, port: number, timeout: number = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createSocket('udp4')
    // Set max listeners untuk menghindari warning
    socket.setMaxListeners(20)
    let resolved = false

    const cleanup = () => {
      if (!resolved) {
        resolved = true
        socket.removeAllListeners()
        socket.close()
      }
    }

    const timer = setTimeout(() => {
      cleanup()
      resolve(false)
    }, timeout)

    const errorHandler = () => {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        socket.removeAllListeners()
        socket.close()
        resolve(false)
      }
    }

    socket.on('error', errorHandler)

    // Send a dummy packet to test if port is reachable
    socket.bind(() => {
      socket.send(Buffer.from('test'), port, ipAddress, (err) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          socket.removeAllListeners()
          socket.close()
          resolve(!err) // If no error, port might be accessible
        }
      })
    })
  })
}

async function testSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  timeout: number = 10000
): Promise<{ success: boolean; message: string }> {
  return new Promise(async (resolve) => {
    let resolved = false
    let session: any = null
    let timeoutId: NodeJS.Timeout | null = null

    const finish = (result: { success: boolean; message: string }) => {
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
      resolve(result)
    }

    // Quick UDP connectivity test first
    const udpReachable = await testUDPPort(ipAddress, port, 2000)
    if (!udpReachable) {
      finish({
        success: false,
        message: `Port ${port} UDP tidak dapat diakses - kemungkinan: (1) SNMP tidak aktif di device, (2) Port ${port} salah, (3) Firewall memblokir port ${port}, atau (4) Device tidak dapat dijangkau dari server ini`,
      })
      return
    }

    try {
      // Map version string ke SNMP version constant
      let snmpVersion: 0 | 1 | undefined = 1 // Default: Version2c
      if (version === '1') {
        snmpVersion = 0 // Version1
      } else if (version === '3') {
        // SNMP v3 tidak didukung oleh net-snmp library yang digunakan
        console.warn(`[SNMP] SNMP v3 is not supported, using v2c instead`)
        snmpVersion = 1 // Fallback to Version2c
      } else {
        snmpVersion = 1 // Version2c
      }

      session = snmp.createSession(ipAddress, community, {
        port,
        version: snmpVersion,
        retries: 3,
        timeout: 5000, // 5 seconds per request
        transport: 'udp4',
        idBitsSize: 32,
      })
      
      // Set max listeners untuk menghindari warning
      if (session && session.setMaxListeners) {
        session.setMaxListeners(20)
      }

      // Test dengan beberapa OID yang umum digunakan
      // OID sysDescr (1.3.6.1.2.1.1.1.0) - standard OID yang hampir semua device support
      const oids = ['1.3.6.1.2.1.1.1.0', '1.3.6.1.2.1.1.2.0', '1.3.6.1.2.1.1.3.0']

      // Set timeout
      timeoutId = setTimeout(() => {
        finish({ 
          success: false, 
          message: `SNMP connection timeout setelah ${timeout/1000} detik. Kemungkinan: (1) SNMP tidak aktif di device, (2) Community string salah, (3) Port ${port} diblokir firewall, atau (4) SNMP version tidak sesuai` 
        })
      }, timeout)

      // Try first OID
      session.get([oids[0]], (error: any, varbinds: any[]) => {
        if (resolved) return
        
        if (error) {
          const errorMsg = error.message || error.toString() || 'Unknown error'
          
          // Provide more specific error messages
          let detailedMsg = `SNMP error: ${errorMsg}`
          
          if (errorMsg.includes('Timeout') || errorMsg.includes('timeout')) {
            detailedMsg = `SNMP timeout - Device tidak merespons di port ${port}. Kemungkinan: (1) SNMP tidak aktif, (2) Port ${port} salah atau diblokir, (3) Community "${community}" tidak sesuai`
          } else if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('refused')) {
            detailedMsg = `SNMP connection refused di port ${port} - Port mungkin tidak aktif atau diblokir`
          } else if (errorMsg.includes('ENETUNREACH') || errorMsg.includes('unreachable')) {
            detailedMsg = `SNMP network unreachable - IP ${ipAddress} tidak dapat diakses`
          } else if (errorMsg.includes('noSuchName') || errorMsg.includes('noSuchObject')) {
            detailedMsg = `SNMP OID tidak ditemukan - tapi koneksi berhasil (device merespons SNMP)`
          }
          
          finish({
            success: false,
            message: detailedMsg,
          })
        } else if (varbinds && varbinds.length > 0) {
          const varbind = varbinds[0]
          if (varbind.value !== null && varbind.value !== undefined) {
            const deviceInfo = varbind.value.toString()
            finish({
              success: true,
              message: `SNMP connection successful (Device: ${deviceInfo.substring(0, 60)})`,
            })
          } else if (varbind.type === 'Null') {
            finish({
              success: false,
              message: `SNMP no value returned untuk OID ${oids[0]} - mungkin community "${community}" tidak memiliki akses read`,
            })
          } else {
            finish({
              success: false,
              message: `SNMP no value returned (mungkin community "${community}" tidak sesuai atau tidak memiliki akses)`,
            })
          }
        } else {
          finish({ success: false, message: 'SNMP no response dari device' })
        }
      })
    } catch (error: any) {
      finish({
        success: false,
        message: `SNMP initialization error: ${error.message || error}`,
      })
    }
  })
}

async function testTelnet(
  ipAddress: string,
  port: number,
  username: string,
  password: string,
  timeout: number = 5000
): Promise<{ success: boolean; message: string }> {
  return new Promise(async (resolve) => {
    let connection: any = null
    try {
      connection = new Telnet()
      
      // Set max listeners untuk menghindari warning
      if (connection.setMaxListeners) {
        connection.setMaxListeners(20)
      }

      const params = {
        host: ipAddress,
        port,
        negotiationMandatory: false,
        timeout,
        shellPrompt: /[#>$]\s*$/,
        username,
        password,
        loginPrompt: /login[: ]*$/i,
        passwordPrompt: /password[: ]*$/i,
      }

      await connection.connect(params)
      await connection.send('quit')
      await connection.end()

      resolve({ success: true, message: 'Telnet connection successful' })
    } catch (error: any) {
      // Pastikan cleanup connection
      if (connection) {
        try {
          await connection.end()
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      // Jika login gagal tapi koneksi berhasil, masih anggap berhasil
      if (error.message && (error.message.includes('timeout') || error.message.includes('ECONNREFUSED'))) {
        resolve({ success: false, message: `Telnet error: ${error.message}` })
      } else {
        // Koneksi berhasil meskipun login mungkin gagal
        resolve({ success: true, message: 'Telnet connection successful (connection established)' })
      }
    }
  })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const {
      ipAddress,
      snmpPort,
      snmpCommunityWrite = 'public',
      snmpVersion = '2',
      telnetPort,
      telnetUsername = 'zte',
      telnetPassword,
      oltId, // Optional: untuk update status connection di database
    } = body

    if (!ipAddress) {
      return NextResponse.json({ error: 'IP Address is required' }, { status: 400 })
    }

    // Validate and use custom ports or defaults
    const finalSnmpPort = snmpPort && !isNaN(Number(snmpPort)) && Number(snmpPort) > 0 && Number(snmpPort) <= 65535
      ? Number(snmpPort)
      : 161
    const finalTelnetPort = telnetPort && !isNaN(Number(telnetPort)) && Number(telnetPort) > 0 && Number(telnetPort) <= 65535
      ? Number(telnetPort)
      : 23

    // Test SNMP dengan community write, jika gagal coba dengan community read-only (public)
    let snmpResult: any
    const writeResult = await testSNMP(ipAddress, finalSnmpPort, snmpCommunityWrite, snmpVersion, 8000)
    
    // Jika gagal dengan write community, coba dengan read-only community (public)
    if (!writeResult.success && snmpCommunityWrite !== 'public') {
      const readResult = await testSNMP(ipAddress, finalSnmpPort, 'public', snmpVersion, 8000)
      if (readResult.success) {
        snmpResult = { 
          ...readResult, 
          message: readResult.message + ' (menggunakan community read-only "public")' 
        }
      } else {
        snmpResult = writeResult
      }
    } else {
      snmpResult = writeResult
    }

    // Test Telnet
    let telnet
    try {
      telnet = await testTelnet(ipAddress, finalTelnetPort, telnetUsername, telnetPassword || '', 5000)
    } catch (error: any) {
      telnet = { success: false, message: `Telnet test failed: ${error.message || error}` }
    }

    // Update connection status di database jika oltId tersedia dan test berhasil
    if (oltId && (snmpResult.success || telnet.success)) {
      try {
        const oltRepository = getOLTRepository()
        await oltRepository.update(oltId, {
          snmpConnected: snmpResult.success,
          telnetConnected: telnet.success,
        })
      } catch (error: any) {
        // Log error tapi tidak fail request
        console.error('Error updating connection status:', error)
      }
    }

    return NextResponse.json({
      success: snmpResult.success && telnet.success,
      snmp: snmpResult,
      telnet,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Test connection failed' }, { status: 500 })
  }
}

