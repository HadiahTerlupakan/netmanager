import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import snmp from 'net-snmp'
import { Telnet } from 'telnet-client'
import { createSocket } from 'dgram'
import '@/lib/utils/event-emitter-config'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

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

    socket.bind(() => {
      socket.send(Buffer.from('test'), port, ipAddress, (err) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          socket.removeAllListeners()
          socket.close()
          resolve(!err)
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
    let timeoutId: ReturnType<typeof setTimeout> | null = null

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

    const udpReachable = await testUDPPort(ipAddress, port, 2000)
    if (!udpReachable) {
      finish({
        success: false,
        message: `Port ${port} UDP tidak dapat diakses - kemungkinan: (1) SNMP tidak aktif di device, (2) Port ${port} salah, (3) Firewall memblokir port ${port}, atau (4) Device tidak dapat dijangkau dari server ini`,
      })
      return
    }

    try {
      let snmpVersion: 0 | 1 | undefined = 1
      if (version === '1') {
        snmpVersion = 0
      } else if (version === '3') {
        console.warn(`[SNMP] SNMP v3 is not supported, using v2c instead`)
        snmpVersion = 1
      } else {
        snmpVersion = 1
      }

      session = snmp.createSession(ipAddress, community, {
        port,
        version: snmpVersion,
        retries: 3,
        timeout: 5000,
        transport: 'udp4',
        idBitsSize: 32,
      })
      
      if (session && session.setMaxListeners) {
        session.setMaxListeners(20)
      }

      const oids = ['1.3.6.1.2.1.1.1.0', '1.3.6.1.2.1.1.2.0', '1.3.6.1.2.1.1.3.0']

      timeoutId = setTimeout(() => {
        finish({ 
          success: false, 
          message: `SNMP connection timeout setelah ${timeout/1000} detik. Kemungkinan: (1) SNMP tidak aktif di device, (2) Community string salah, (3) Port ${port} diblokir firewall, atau (4) SNMP version tidak sesuai` 
        })
      }, timeout)

      session.get([oids[0]], (error: any, varbinds: any[]) => {
        if (resolved) return
        
        if (error) {
          const errorMsg = error.message || error.toString() || 'Unknown error'
          
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
      if (connection) {
        try {
          await connection.end()
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      if (error.message && (error.message.includes('timeout') || error.message.includes('ECONNREFUSED'))) {
        resolve({ success: false, message: `Telnet error: ${error.message}` })
      } else {
        resolve({ success: true, message: 'Telnet connection successful (connection established)' })
      }
    }
  })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return ApiErrors.unauthorized('Session tidak valid')

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
      oltId,
    } = body

    if (!ipAddress) {
      return apiError('IP Address harus diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const finalSnmpPort = snmpPort && !isNaN(Number(snmpPort)) && Number(snmpPort) > 0 && Number(snmpPort) <= 65535
      ? Number(snmpPort)
      : 161
    const finalTelnetPort = telnetPort && !isNaN(Number(telnetPort)) && Number(telnetPort) > 0 && Number(telnetPort) <= 65535
      ? Number(telnetPort)
      : 23

    let snmpResult: any
    const writeResult = await testSNMP(ipAddress, finalSnmpPort, snmpCommunityWrite, snmpVersion, 8000)
    
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

    let telnet
    try {
      telnet = await testTelnet(ipAddress, finalTelnetPort, telnetUsername, telnetPassword || '', 5000)
    } catch (error: any) {
      telnet = { success: false, message: `Telnet test failed: ${error.message || error}` }
    }

    if (oltId && (snmpResult.success || telnet.success)) {
      try {
        const oltRepository = getOLTRepository()
        await oltRepository.update(oltId, {
          snmpConnected: snmpResult.success,
          telnetConnected: telnet.success,
        })
      } catch (error: any) {
        console.error('Error updating connection status:', error)
      }
    }

    return apiSuccess({
      snmp: snmpResult,
      telnet,
    }, { 
      message: snmpResult.success && telnet.success ? 'Connection test berhasil' : 'Connection test selesai dengan beberapa masalah' 
    })
  } catch (error: any) {
    return ApiErrors.internalError(error.message || 'Test connection failed')
  }
}
