import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import { Telnet } from 'telnet-client'
import snmp from 'net-snmp'

// Error handler untuk menangkap error "req.doneCb is not a function"
// Error ini adalah bug internal dari library net-snmp yang terjadi
// ketika callback dipanggil setelah session ditutup
if (typeof process !== 'undefined') {
  // Hapus handler lama jika ada
  const existingHandlers = process.listeners('uncaughtException')
  existingHandlers.forEach((handler: any) => {
    if (handler._snmpDoneCbHandler) {
      process.removeListener('uncaughtException', handler)
    }
  })
  
  // Helper function untuk check apakah error adalah doneCb error
  const isDoneCbError = (error: any): boolean => {
    if (!error) return false
    const message = error.message || error.toString() || ''
    return (
      message.includes('req.doneCb is not a function') ||
      message.includes('doneCb is not a function') ||
      message.includes('TypeError: req.doneCb') ||
      (message.includes('TypeError: Cannot read property') && message.includes('doneCb')) ||
      (error.name === 'TypeError' && message.includes('doneCb'))
    )
  }
  
  const snmpErrorHandler = (error: Error) => {
    // Filter error "req.doneCb is not a function" dan abaikan sepenuhnya
    if (isDoneCbError(error)) {
      // Abaikan error ini sepenuhnya - ini adalah bug internal net-snmp
      // Data sudah berhasil diambil meskipun error ini muncul
      // Jangan log apapun untuk menghindari spam di console
      return
    }
    
    // Untuk error lain yang tidak terkait SNMP, biarkan default handler menanganinya
    // Tapi kita tidak ingin crash aplikasi, jadi kita log saja
    if (error && error.message && !error.message.includes('SNMP') && !error.message.includes('snmp')) {
      console.warn(`[SNMP] Uncaught exception (non-doneCb): ${error.message}`)
    }
  }
  
  // Mark handler untuk mencegah duplikasi
  ;(snmpErrorHandler as any)._snmpDoneCbHandler = true
  
  // Tambahkan handler dengan prependListener untuk memastikan handler ini dipanggil pertama
  process.prependListener('uncaughtException', snmpErrorHandler)
  
  // Juga tambahkan handler untuk unhandledRejection jika diperlukan
  process.prependListener('unhandledRejection', (reason: any) => {
    if (isDoneCbError(reason)) {
      // Abaikan - jangan log apapun
      return
    }
  })
  
  // Override console.error untuk menekan doneCb error di console
  const originalConsoleError = console.error
  console.error = (...args: any[]) => {
    // Check jika ada doneCb error di arguments
    const hasDoneCbError = args.some(arg => {
      if (typeof arg === 'string') {
        return isDoneCbError({ message: arg })
      }
      if (arg instanceof Error) {
        return isDoneCbError(arg)
      }
      return false
    })
    
    // Jika bukan doneCb error, log seperti biasa
    if (!hasDoneCbError) {
      originalConsoleError.apply(console, args)
    }
    // Jika doneCb error, abaikan (jangan log)
  }
}

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

// SNMP OIDs untuk ZTE OLT - ONU Management
// Berdasarkan script bash: 1.3.6.1.4.1.3902.1012.3.28.2.1.4."$PON"
const SNMP_ONU_OIDS = {
  // Status ONU per PON: 1.3.6.1.4.1.3902.1012.3.28.2.1.4.{PON}
  // Status values: 1=LOS, 3=Online, 4=DyingGasp, 6=OffLine
  onuStatus: '1.3.6.1.4.1.3902.1012.3.28.2.1.4',
  // Serial Number: 1.3.6.1.4.1.3902.1012.3.28.2.1.5.{PON}.{ONU_ID}
  onuSerial: '1.3.6.1.4.1.3902.1012.3.28.2.1.5',
  // RX OLT: 1.3.6.1.4.1.3902.1012.3.28.2.1.6.{PON}.{ONU_ID} (dalam 0.01 dBm)
  onuRxOlt: '1.3.6.1.4.1.3902.1012.3.28.2.1.6',
  // RX ONU: 1.3.6.1.4.1.3902.1012.3.28.2.1.7.{PON}.{ONU_ID} (dalam 0.01 dBm)
  onuRxOnu: '1.3.6.1.4.1.3902.1012.3.28.2.1.7',
  // ONU Type/Model: 1.3.6.1.4.1.3902.1012.3.28.2.1.8.{PON}.{ONU_ID}
  onuType: '1.3.6.1.4.1.3902.1012.3.28.2.1.8',
  // ONU Name: 1.3.6.1.4.1.3902.1012.3.28.2.1.9.{PON}.{ONU_ID}
  onuName: '1.3.6.1.4.1.3902.1012.3.28.2.1.9',
  // ONU Description: 1.3.6.1.4.1.3902.1012.3.28.2.1.10.{PON}.{ONU_ID}
  onuDescription: '1.3.6.1.4.1.3902.1012.3.28.2.1.10',
  // PON Port List: 1.3.6.1.4.1.3902.1012.3.28.1.1.1
  ponPortList: '1.3.6.1.4.1.3902.1012.3.28.1.1.1',
  // PON Port Info: 1.3.6.1.4.1.3902.1012.3.28.1.1.2 (mungkin berisi slot/card/port info)
  ponPortInfo: '1.3.6.1.4.1.3902.1012.3.28.1.1.2',
}

// SNMP OIDs untuk ZTE C3XX OLT - ONU Management
// Berdasarkan plugin Checkmk: .1.3.6.1.4.1.3902.1082
// Dan dari SNMP walk output: enterprises.3902.1082.500.10.4.2.* dan enterprises.3902.1082.500.20.4.2.*
const SNMP_C3XX_ONU_OIDS = {
  // Base OID untuk ZTE C3XX
  baseOid: '1.3.6.1.4.1.3902.1082',
  // ONU ID: .1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2 (index 0)
  onuId: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2',
  // ONU Name: .1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2 (index 1)
  onuName: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2',
  // ONU Type Name: .1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.1 (index 2)
  onuType: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.1',
  // ONU Description: .1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3 (index 3)
  onuDescription: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3',
  // ONU Optical Rx: .1.3.6.1.4.1.3902.1082.500.20.2.2.2.1.10 (index 4)
  onuRx: '1.3.6.1.4.1.3902.1082.500.20.2.2.2.1.10',
  // ONU Optical Tx: .1.3.6.1.4.1.3902.1082.500.20.2.2.2.1.14 (index 5)
  onuTx: '1.3.6.1.4.1.3902.1082.500.20.2.2.2.1.14',
  // OLT Optical Rx from ONU: .1.3.6.1.4.1.3902.1082.500.1.2.4.2.1.2 (index 6)
  oltRx: '1.3.6.1.4.1.3902.1082.500.1.2.4.2.1.2',
  // ONU Status: .1.3.6.1.4.1.3902.1082.500.10.2.3.8.1.4 (index 7)
  onuStatus: '1.3.6.1.4.1.3902.1082.500.10.2.3.8.1.4',
  // ONU Auth: .1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.18 (index 8)
  onuAuth: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.18',
  // System OID untuk deteksi: .1.3.6.1.2.1.1.2.0
  sysObjectId: '1.3.6.1.2.1.1.2.0',
  // OID alternatif dari SNMP walk output untuk mendapatkan daftar port/ONU
  // OID untuk ONU Management Group (dari sysORDescr: enterprises.3902.1082.500.10.4.2.*)
  onuMgmtGroup: '1.3.6.1.4.1.3902.1082.500.10.4.2',
  // OID untuk ONU Performance/Optical Group (dari sysORDescr: enterprises.3902.1082.500.20.4.2.*)
  onuPerfGroup: '1.3.6.1.4.1.3902.1082.500.20.4.2',
  // OID alternatif untuk PON port list (mungkin lebih lengkap)
  // Coba gunakan OID dari base 1082 untuk mendapatkan daftar port
  ponPortListAlt: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2', // Sama dengan onuName, tapi bisa digunakan untuk scan port
}

// Status mapping untuk ZTE C3XX (berdasarkan kode Python)
const C3XX_ONU_STATUS = [
  'unknown',
  'logging',
  'los',
  'syncMib',
  'working',
  'dyingGasp',
  'authFailed',
  'offline',
]

// Auth mode mapping untuk ZTE C3XX
const C3XX_ONU_AUTH_MODE = [
  'unknow',
  'SN',
  'PWD',
  'SN+PWD',
  'RegID',
  'RedID+802.1x',
  'RedID+Mutual',
  'HexPWD',
  'SN+HexPWD',
  'Loid',
  'Loid+PWD',
]

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

    let stableCheckTimeout: NodeJS.Timeout | null = null
    let nullifyInterval: NodeJS.Timeout | null = null
    
    // Fungsi untuk nullify semua callback di session (didefinisikan di scope tinggi agar bisa diakses dari processCallback)
    const nullifyAllCallbacks = (sess: any) => {
      if (!sess) return
      
      try {
        // Lokasi 1: session._socket._reqs
        if (sess._socket && sess._socket._reqs) {
          const reqs = sess._socket._reqs
          for (const reqId in reqs) {
            if (reqs[reqId]) {
              try {
                if (typeof reqs[reqId].doneCb === 'function') {
                  reqs[reqId].doneCb = null
                }
                if (typeof reqs[reqId].callback === 'function') {
                  reqs[reqId].callback = null
                }
                // Juga coba nullify di berbagai lokasi yang mungkin
                if (reqs[reqId].cb) reqs[reqId].cb = null
                if (reqs[reqId].done) reqs[reqId].done = null
              } catch (e) {
                // Ignore error per request
              }
            }
          }
        }
        // Lokasi 2: session.reqs (alternatif)
        if ((sess as any).reqs) {
          const reqs = (sess as any).reqs
          for (const reqId in reqs) {
            if (reqs[reqId]) {
              try {
                if (typeof reqs[reqId].doneCb === 'function') {
                  reqs[reqId].doneCb = null
                }
                if (typeof reqs[reqId].callback === 'function') {
                  reqs[reqId].callback = null
                }
                if (reqs[reqId].cb) reqs[reqId].cb = null
                if (reqs[reqId].done) reqs[reqId].done = null
              } catch (e) {
                // Ignore error per request
              }
            }
          }
        }
        // Lokasi 3: session._socket mungkin punya reqs langsung
        if (sess._socket) {
          try {
            if (sess._socket.reqs) {
              const reqs = sess._socket.reqs
              for (const reqId in reqs) {
                if (reqs[reqId]) {
                  try {
                    if (typeof reqs[reqId].doneCb === 'function') {
                      reqs[reqId].doneCb = null
                    }
                    if (typeof reqs[reqId].callback === 'function') {
                      reqs[reqId].callback = null
                    }
                  } catch (e) {
                    // Ignore
                  }
                }
              }
            }
          } catch (e) {
            // Ignore
          }
        }
      } catch (reqError) {
        // Ignore error saat mengakses _reqs - ini adalah bug internal net-snmp
      }
    }
    
    const finish = (error?: any) => {
      if (resolved) return
      resolved = true
      
      // Clear semua timeout dan interval
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (stableCheckTimeout) {
        clearTimeout(stableCheckTimeout)
        stableCheckTimeout = null
      }
      if (nullifyInterval) {
        clearInterval(nullifyInterval)
        nullifyInterval = null
      }
      
      // Set flag bahwa kita sedang menutup session
      isClosing = true
      
      // Fungsi untuk menutup session dengan aman
      const closeSessionSafely = () => {
        if (session) {
          try {
            // Nullify semua callback SEBELUM menutup session
            nullifyAllCallbacks(session)
            
            // Cek apakah session masih valid sebelum menutup
            if (typeof session.close === 'function') {
              // Tunggu sebentar sebelum close untuk memastikan semua callback selesai
              // Tapi nullify dulu untuk mencegah callback dipanggil
              setTimeout(() => {
                try {
                  // Nullify lagi sebelum close untuk memastikan
                  nullifyAllCallbacks(session)
                  session.close()
                } catch (closeError: any) {
                  // Abaikan error saat menutup session - ini adalah bug internal net-snmp
                  // Error "req.doneCb is not a function" bisa terjadi di sini
                  // Tapi kita sudah handle di global error handler
                }
              }, 200) // Delay 200ms untuk memastikan semua callback selesai
            }
          } catch (e: any) {
            // Ignore error saat menutup session - ini adalah bug internal net-snmp
            // Error "req.doneCb is not a function" biasanya terjadi di sini
            // Tapi kita sudah handle dengan set callback ke null di atas dan global error handler
            if (e && e.message && !e.message.includes('doneCb') && !e.message.includes('not a function')) {
              // Log error lain selain doneCb
              console.warn(`[SNMP-Walk] Error closing session: ${e.message}`)
            }
          } finally {
            session = null
          }
        }
      }
      
      // Nullify semua callback SEBELUM menunggu
      if (session) {
        nullifyAllCallbacks(session)
      }
      
      // Tunggu sebentar untuk memastikan semua callback selesai
      // sebelum menutup session
      // Jika masih ada pending callbacks, tunggu lebih lama
      const waitTime = pendingCallbacks > 0 ? 800 : 300
      
      // Nullify callback beberapa kali selama wait untuk memastikan semua callback dinonaktifkan
      nullifyInterval = setInterval(() => {
        if (session && !resolved && !isClosing) {
          nullifyAllCallbacks(session)
        }
      }, 100) // Nullify setiap 100ms
      
      setTimeout(() => {
        if (nullifyInterval) {
          clearInterval(nullifyInterval)
          nullifyInterval = null
        }
        // Nullify lagi sebelum close untuk memastikan
        if (session) {
          nullifyAllCallbacks(session)
        }
        closeSessionSafely()
      }, waitTime)
      
      // Return results atau error
      if (error) {
        // Jika error tapi ada results, return results saja
        if (results.length > 0) {
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
        // SNMP v3 tidak didukung oleh net-snmp library yang digunakan
        console.warn(`[SNMP] SNMP v3 is not supported, using v2c instead`)
        snmpVersion = 1 // Fallback to Version2c
      }

      session = snmp.createSession(ipAddress, community, {
        port,
        version: snmpVersion,
        retries: 5, // Increase retries untuk data yang banyak
        timeout: 30000, // Increase timeout ke 30 detik per request (dari 10 detik)
      })
      
      console.log(`[All-ONU-SNMP] SNMP session created with retries: 5, timeout: 30000ms`)

      timeoutId = setTimeout(() => {
        // Jika sudah ada results, tunggu lebih lama untuk memastikan tidak ada data lagi
        // Untuk data yang banyak (100+ ONU), walk bisa memakan waktu lebih lama
        if (results.length > 0) {
          console.log(`[All-ONU-SNMP] SNMP walk timeout reached with ${results.length} results, waiting 20 seconds for more data...`)
          // Tunggu 20 detik lagi untuk memastikan tidak ada data lagi (diperpanjang dari 5 detik)
          // Ini penting untuk data yang banyak
          if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
          stableCheckTimeout = setTimeout(() => {
            if (!resolved && !isClosing) {
              console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (timeout reached, no more data after 20s wait)`)
              finish()
            }
          }, 20000)
        } else {
          // Jika tidak ada results sama sekali, tunggu juga
          console.log(`[All-ONU-SNMP] SNMP walk timeout with no results, waiting 10 seconds before giving up...`)
          if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
          stableCheckTimeout = setTimeout(() => {
            if (!resolved && !isClosing && results.length === 0) {
              finish(new Error('SNMP walk timeout - no results'))
            }
          }, 10000)
        }
      }, timeout)

      // Gunakan subtree dengan callback yang benar
      // Callback bisa dipanggil beberapa kali untuk batch data
      let callbackCount = 0
      let lastOid = ''
      let noDataCount = 0
      
      const processCallback = (error: any, varbinds: any[]) => {
        // Cek resolved atau isClosing dulu sebelum melakukan apapun
        // Jika sudah closing atau resolved, nullify callback untuk mencegah error
        if (resolved || isClosing) {
          // Nullify callback di session untuk mencegah error "req.doneCb is not a function"
          if (session) {
            try {
              nullifyAllCallbacks(session)
            } catch (e) {
              // Ignore
            }
          }
          return
        }
        
        callbackCount++
        pendingCallbacks++

        try {
          // PENTING: Terkadang "error" sebenarnya adalah array dari varbinds (data)
          // Ini terjadi karena net-snmp library kadang melempar data sebagai error
          // Cek apakah error adalah array - jika ya, proses sebagai data
          let dataVarbinds: any[] | null = null
          let actualError: any = null
          
          // Cek apakah error adalah array (data) atau error sebenarnya
          if (error) {
            if (Array.isArray(error) && error.length > 0) {
              // Error sebenarnya adalah array data
              console.log(`[All-ONU-SNMP] SNMP walk "error" is actually data array with ${error.length} entries, processing as varbinds...`)
              dataVarbinds = error
              actualError = null // Reset error karena ini sebenarnya data
            } else {
              // Ini adalah error sebenarnya
              actualError = error
            }
          }
          
          if (actualError) {
            // Ini adalah error sebenarnya
            const errorMsg = actualError?.message || String(actualError)
            console.warn(`[All-ONU-SNMP] SNMP walk callback error: ${errorMsg}, current results: ${results.length}`)
            
            // Jika error tapi sudah ada results, JANGAN langsung finish
            // Terkadang error terjadi di tengah-tengah walk tapi data masih bisa masuk
            // Tunggu lebih lama dan biarkan callback dipanggil lagi jika ada data lebih lanjut
            if (results.length > 0) {
              console.log(`[All-ONU-SNMP] SNMP walk error but have ${results.length} results, waiting 15 seconds for more data (walk may continue)...`)
              // Tunggu 15 detik untuk memastikan tidak ada data lagi (diperpanjang dari 10 detik)
              // Jangan langsung finish, biarkan walk melanjutkan jika ada data lebih lanjut
              if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
              stableCheckTimeout = setTimeout(() => {
                if (!resolved && !isClosing) {
                  console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (error occurred but results available after 15s wait)`)
                  finish()
                }
              }, 15000)
              // JANGAN return di sini - biarkan walk melanjutkan jika ada data lebih lanjut
              // Hanya decrement pending callbacks
              pendingCallbacks--
              return
            } else {
              // Jika tidak ada results sama sekali, tunggu sebentar juga
              // Mungkin data masih akan masuk
              console.log(`[All-ONU-SNMP] SNMP walk error with no results, waiting 5 seconds before giving up...`)
              if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
              stableCheckTimeout = setTimeout(() => {
                if (!resolved && !isClosing && results.length === 0) {
                  console.log(`[All-ONU-SNMP] SNMP walk failed: no results after error`)
                  finish(actualError)
                }
              }, 5000)
              pendingCallbacks--
              return
            }
          }

          // Jika ada dataVarbinds dari error, gunakan itu; jika tidak, gunakan varbinds normal
          const varbindsToProcess = dataVarbinds || varbinds
          
          if (!varbindsToProcess || varbindsToProcess.length === 0) {
            // Jika tidak ada varbinds, tunggu sebentar untuk memastikan tidak ada data lagi
            // Untuk data yang banyak, tunggu lebih lama (10 kali) sebelum menganggap walk selesai
            noDataCount++
            if (results.length > 0 && noDataCount >= 10) {
              if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
              stableCheckTimeout = setTimeout(() => {
                if (!resolved && !isClosing) {
                  console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (no more varbinds after ${noDataCount} empty responses, waiting 10s)`)
                  finish()
                }
              }, 10000) // Tunggu 10 detik untuk memastikan tidak ada data lagi (diperpanjang dari 5 detik)
            }
            pendingCallbacks--
            return
          }

          // Reset no data count karena ada data baru
          noDataCount = 0
          
          // Clear stable check timeout karena ada data baru
          if (stableCheckTimeout) {
            clearTimeout(stableCheckTimeout)
            stableCheckTimeout = null
          }

          // Log progress setiap batch data
          const batchSize = varbindsToProcess.length
          const totalBefore = results.length
          console.log(`[All-ONU-SNMP] Received batch: ${batchSize} varbinds, total so far: ${totalBefore} -> ${totalBefore + batchSize}`)

          let hasEndOfMibView = false
          let currentLastOid = lastOid
          
          for (const varbind of varbindsToProcess) {
            if (varbind.type === snmp.ObjectType.EndOfMibView) {
              hasEndOfMibView = true
              break
            }
            
            // Track last OID untuk mendeteksi apakah masih ada data
            // Bandingkan OID secara lexicographic (string comparison)
            if (varbind.oid) {
              const oidStr = String(varbind.oid)
              const currentOidStr = String(currentLastOid)
              // Bandingkan secara lexicographic - OID adalah string yang bisa dibandingkan langsung
              if (oidStr > currentOidStr) {
                currentLastOid = varbind.oid
              }
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
              oid: varbind.oid,
              value: value,
              type: varbind.type,
            })
          }

          // Update last OID
          if (currentLastOid !== lastOid) {
            lastOid = currentLastOid
          }

          // Jika ada EndOfMibView, tunggu sebentar untuk memastikan tidak ada data lagi
          // Terkadang EndOfMibView muncul terlalu cepat, terutama untuk data yang banyak
          if (hasEndOfMibView) {
            console.log(`[All-ONU-SNMP] EndOfMibView detected with ${results.length} results, waiting 10 seconds to ensure no more data...`)
            // Tunggu 10 detik untuk memastikan tidak ada data lagi setelah EndOfMibView (diperpanjang dari 3 detik)
            if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
            stableCheckTimeout = setTimeout(() => {
              if (!resolved && !isClosing) {
                console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (EndOfMibView reached, no more data after 10s wait)`)
                finish()
              }
            }, 10000)
            pendingCallbacks--
            return
          }

          // Jika OID tidak berubah (tidak ada data baru), tunggu sebentar
          // Untuk data yang banyak, tunggu lebih lama (10 detik) untuk memastikan semua data diambil
          if (currentLastOid === lastOid && results.length > 0) {
            if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
            stableCheckTimeout = setTimeout(() => {
              if (!resolved && !isClosing) {
                console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (no more data, OID stable after 10s wait)`)
                finish()
              }
            }, 10000) // Tunggu 10 detik untuk memastikan tidak ada data lagi (diperpanjang dari 5 detik)
          } else if (currentLastOid !== lastOid) {
            // Jika ada data baru, reset stable check timeout
            if (stableCheckTimeout) {
              clearTimeout(stableCheckTimeout)
              stableCheckTimeout = null
            }
            // Log progress setiap 50 entri untuk monitoring
            if (results.length % 50 === 0) {
              console.log(`[All-ONU-SNMP] SNMP walk progress: ${results.length} entries collected so far...`)
            }
          }
        } catch (callbackError: any) {
          // Tangkap error di callback untuk mencegah crash
          if (!isClosing && !resolved) {
            console.warn(`[SNMP-Walk] Error in callback: ${callbackError?.message || callbackError}`)
            // Jika error tapi sudah ada results, lanjutkan
            // Untuk data yang banyak, tunggu lebih lama untuk memastikan tidak ada data lagi
            if (results.length > 0) {
              // Tunggu 10 detik untuk memastikan tidak ada data lagi (diperpanjang dari 5 detik)
              if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
              stableCheckTimeout = setTimeout(() => {
                if (!resolved && !isClosing) {
                  console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (callback error but results available after 10s wait)`)
                  finish()
                }
              }, 10000)
            }
          }
        } finally {
          // Decrement pending callbacks
          pendingCallbacks--
        }
      }

      try {
        // Wrap subtree call dengan try-catch untuk menangkap error internal
        try {
          session.subtree(oid, processCallback)
        } catch (subtreeCallError: any) {
          // Jika error saat memanggil subtree, tapi sudah ada results, return results
          if (results.length > 0) {
            console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (subtree call error but results available)`)
            finish()
            return
          }
          // Jika belum ada results, tunggu sebentar untuk memastikan tidak ada callback yang masih pending
          setTimeout(() => {
            if (results.length > 0) {
              finish()
            } else {
              finish(subtreeCallError)
            }
          }, 1000)
          return
        }
      } catch (outerError) {
        // Jika error di level luar, tapi sudah ada results, return results
        if (results.length > 0) {
          console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (outer error but results available)`)
          finish()
        } else {
          finish(outerError)
        }
      }
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
  oid: string,
  timeout: number = 5000
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
        // SNMP v3 tidak didukung oleh net-snmp library yang digunakan
        console.warn(`[SNMP] SNMP v3 is not supported, using v2c instead`)
        snmpVersion = 1 // Fallback to Version2c
      }

      session = snmp.createSession(ipAddress, community, {
        port,
        version: snmpVersion,
        retries: 2,
        timeout: 3000,
      })

      timeoutId = setTimeout(() => {
        finish(null)
      }, timeout)

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
    } catch (error) {
      finish(null)
    }
  })
}

// Deteksi apakah OLT adalah ZTE C3XX berdasarkan sysObjectID
export async function isZteC3xx(
  ipAddress: string,
  port: number,
  community: string,
  version: string
): Promise<boolean> {
  try {
    const sysObjectId = await snmpGet(ipAddress, port, community, version, SNMP_C3XX_ONU_OIDS.sysObjectId, 5000)
    if (!sysObjectId) return false
    
    // Berdasarkan kode Python: oid(".1.3.6.1.2.1.1.2.0").startswith('.1.3.6.1.4.1.3902.1082.1001')
    return sysObjectId.startsWith('.1.3.6.1.4.1.3902.1082.1001') || sysObjectId.startsWith('1.3.6.1.4.1.3902.1082.1001')
  } catch (error) {
    console.warn(`[C3XX-Detection] Error detecting ZTE C3XX:`, error)
    return false
  }
}

// Helper function untuk convert value ke integer (mirip saveint di Python)
function saveint(value: any): number {
  if (value === null || value === undefined || value === '') return 0
  const parsed = parseInt(String(value))
  return isNaN(parsed) ? 0 : parsed
}

// Helper function untuk convert value ke float (mirip savefloat di Python)
function savefloat(value: any): number {
  if (value === null || value === undefined || value === '') return 0.0
  const parsed = parseFloat(String(value))
  return isNaN(parsed) ? 0.0 : parsed
}

// Parse ONU index dari OID ZTE C3XX
// Berdasarkan log error: Format OID: 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2.{ifIndex}.{onuId}
// Contoh: 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2.285278977.3
//         baseOID = 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2
//         ifIndex = 285278977
//         onuId = 3
function parseC3xxOnuIndexFromOid(oid: string, baseOid: string): { ifIndex: number; onuId: number } | null {
  const oidParts = oid.split('.')
  const baseParts = baseOid.split('.')
  
  // Cari posisi setelah base OID
  // Base OID: 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2
  // Setelah itu: {ifIndex}.{onuId}
  let baseIndex = -1
  for (let i = 0; i <= oidParts.length - baseParts.length; i++) {
    const slice = oidParts.slice(i, i + baseParts.length)
    if (slice.join('.') === baseParts.join('.')) {
      baseIndex = i + baseParts.length
      break
    }
  }
  
  if (baseIndex < 0 || baseIndex >= oidParts.length) {
    return null
  }
  
  // ifIndex adalah angka pertama setelah base OID
  const ifIndex = parseInt(oidParts[baseIndex])
  if (isNaN(ifIndex)) {
    return null
  }
  
  // ONU ID adalah angka setelah ifIndex
  let onuId = 0
  if (baseIndex + 1 < oidParts.length) {
    const onuIdCandidate = parseInt(oidParts[baseIndex + 1])
    if (!isNaN(onuIdCandidate) && onuIdCandidate > 0) {
      onuId = onuIdCandidate
    }
  }
  
  // Jika onuId masih 0, coba ambil dari bagian terakhir OID
  if (onuId === 0 && oidParts.length > baseIndex + 1) {
    const lastPart = parseInt(oidParts[oidParts.length - 1])
    if (!isNaN(lastPart) && lastPart > 0) {
      onuId = lastPart
    }
  }
  
  if (onuId === 0) {
    return null // ONU ID harus ada
  }
  
  return {
    ifIndex,
    onuId,
  }
}

// Convert RX/TX value sesuai logika Python
function convertC3xxRxValue(value: number): number {
  // Berdasarkan kode Python:
  // if (onuRx < 32768):
  //     onuRx = float(onuRx * 0.002) - 30.0
  // elif ((onuRx < 65535) and (onuRx > 32767)):
  //     onuRx = (-30 - ((65535 - onuRx) * 0.002))
  // else:
  //     onuRx = -40.0
  
  if (value < 32768) {
    return parseFloat((value * 0.002 - 30.0).toFixed(2))
  } else if (value < 65535 && value > 32767) {
    return parseFloat((-30 - ((65535 - value) * 0.002)).toFixed(2))
  } else {
    return -40.0
  }
}

function convertC3xxTxValue(value: number): number {
  // Berdasarkan kode Python:
  // if (onuTx < 65535):
  //     onuTx = float(onuTx * 0.002) - 30.0
  // else:
  //     onuTx = -40.0
  
  if (value < 65535) {
    return parseFloat((value * 0.002 - 30.0).toFixed(2))
  } else {
    return -40.0
  }
}

// Helper function untuk convert PON Index ke Frame/Slot/Port/ONU_ID
// Rumus: PON_Index = (frame << 24) + (slot << 16) + (port << 8) + ONU_ID
// Reverse: Frame = (PON_Index >> 24), Slot = (PON_Index >> 16) & 0xFF, Port = (PON_Index >> 8) & 0xFF, ONU_ID = PON_Index & 0xFF
function ponIndexToFrameSlotPortOnu(ponIndex: number): { frame: number; slot: number; port: number; onuId: number } | null {
  const frame = (ponIndex >> 24) & 0xFF
  const slot = (ponIndex >> 16) & 0xFF
  const port = (ponIndex >> 8) & 0xFF
  const onuId = ponIndex & 0xFF
  
  // Validasi: frame bisa 0 (jika hanya ada 1 frame), tapi slot, port, dan onuId harus > 0
  // Jika frame 0, set ke 1 (default untuk single frame system)
  if (slot === 0 || port === 0 || onuId === 0) {
    return null
  }
  
  return { 
    frame: frame === 0 ? 1 : frame, // Default frame ke 1 jika 0
    slot, 
    port, 
    onuId 
  }
}

// Get ONU data untuk ZTE C3XX menggunakan SNMP
// Menggunakan pendekatan sederhana: langsung walk semua OID tanpa discovery port
// Berdasarkan rumus: PON_Index = (frame << 24) + (slot << 16) + (port << 8) + ONU_ID
export async function getC3xxOnuDataViaSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltName: string,
  oltId: string
): Promise<Array<{
  id: string
  oltId: string
  oltName: string
  name: string
  description: string
  pppoe: string
  gponOnu: string
  status: string
  rxOlt: string | null
  rxOnu: string | null
  serialNumber: string
  actualType: string
}>> {
  const onus: Array<{
    id: string
    oltId: string
    oltName: string
    name: string
    description: string
    pppoe: string
    gponOnu: string
    status: string
    rxOlt: string | null
    rxOnu: string | null
    serialNumber: string
    actualType: string
  }> = []

  try {
    console.log(`[C3XX-ONU-SNMP] Fetching ONU data from ${oltName} (${ipAddress}) via SNMP...`)
    console.log(`[C3XX-ONU-SNMP] Using simplified approach: walk all OIDs directly`)

    // Helper function untuk SNMP walk dengan delay
    const walkWithDelay = async (oid: string, delay: number = 0): Promise<any[]> => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      try {
        console.log(`[C3XX-ONU-SNMP] Starting SNMP walk for OID: ${oid}`)
        // Timeout 120 detik untuk data yang banyak (diperpanjang dari 60 detik)
        const result = await snmpWalk(ipAddress, port, community, version, oid, 120000)
        console.log(`[C3XX-ONU-SNMP] Completed SNMP walk for OID: ${oid}, got ${result.length} entries`)
        
        // Log sample OIDs untuk debugging
        if (result.length > 0 && result.length <= 10) {
          console.log(`[C3XX-ONU-SNMP] All OIDs from walk:`)
          result.forEach((r: any, idx: number) => {
            console.log(`[C3XX-ONU-SNMP]   ${idx + 1}. ${r.oid}`)
          })
        } else if (result.length > 10) {
          console.log(`[C3XX-ONU-SNMP] Sample OIDs (first 5 and last 5):`)
          for (let i = 0; i < 5; i++) {
            console.log(`[C3XX-ONU-SNMP]   ${i + 1}. ${result[i]?.oid}`)
          }
          console.log(`[C3XX-ONU-SNMP]   ... (${result.length - 10} more) ...`)
          for (let i = result.length - 5; i < result.length; i++) {
            console.log(`[C3XX-ONU-SNMP]   ${i + 1}. ${result[i]?.oid}`)
          }
        }
        
        return Array.isArray(result) ? result : []
      } catch (error: any) {
        // Jika error tapi hasilnya array (dari error recovery), gunakan array tersebut
        if (Array.isArray(error)) {
          console.log(`[C3XX-ONU-SNMP] Error recovery: got ${error.length} entries from error`)
          return error
        }
        console.warn(`[C3XX-ONU-SNMP] Error in SNMP walk for OID ${oid}:`, error?.message || error)
        return []
      }
    }

    // Step 1: Walk OID untuk mendapatkan semua nama ONU
    // OID: 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2
    // Format OID: baseOid.{PON_INDEX}
    // PON_INDEX = (frame << 24) + (slot << 16) + (port << 8) + ONU_ID
    console.log(`[C3XX-ONU-SNMP] Step 1: Walking ONU Name OID to get all ONUs...`)
    const onuNameOid = '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2'
    const onuNameResults = await walkWithDelay(onuNameOid, 0)
    console.log(`[C3XX-ONU-SNMP] Found ${onuNameResults.length} ONU name entries`)
    
    // Debug: Show first few OIDs to understand the format
    if (onuNameResults.length > 0) {
      console.log(`[C3XX-ONU-SNMP] Sample OIDs (first 5):`)
      for (let i = 0; i < Math.min(5, onuNameResults.length); i++) {
        const result = onuNameResults[i]
        const oidParts = result.oid.split('.')
        const baseParts = onuNameOid.split('.')
        console.log(`[C3XX-ONU-SNMP]   OID ${i + 1}: ${result.oid}`)
        console.log(`[C3XX-ONU-SNMP]     Base OID length: ${baseParts.length}, OID length: ${oidParts.length}`)
        if (oidParts.length > baseParts.length) {
          const afterBase = oidParts.slice(baseParts.length).join('.')
          console.log(`[C3XX-ONU-SNMP]     After base OID: ${afterBase}`)
          const ponIndexStr = oidParts[baseParts.length]
          const ponIndex = parseInt(ponIndexStr)
          if (!isNaN(ponIndex)) {
            const frame = (ponIndex >> 24) & 0xFF
            const slot = (ponIndex >> 16) & 0xFF
            const port = (ponIndex >> 8) & 0xFF
            const onuIdFromPonIndex = ponIndex & 0xFF
            // ONU ID bisa dari bagian terakhir OID atau dari PON Index
            let onuId = onuIdFromPonIndex
            if (oidParts.length > baseParts.length + 1) {
              const onuIdStr = oidParts[oidParts.length - 1]
              const onuIdFromOid = parseInt(onuIdStr)
              if (!isNaN(onuIdFromOid) && onuIdFromOid > 0) {
                onuId = onuIdFromOid
                console.log(`[C3XX-ONU-SNMP]     PON Index: ${ponIndex} -> frame: ${frame}, slot: ${slot}, port: ${port}`)
                console.log(`[C3XX-ONU-SNMP]     ONU ID from OID: ${onuIdFromOid} (using this), from PON Index: ${onuIdFromPonIndex}`)
              } else {
                console.log(`[C3XX-ONU-SNMP]     PON Index: ${ponIndex} -> frame: ${frame}, slot: ${slot}, port: ${port}, onuId: ${onuId}`)
              }
            } else {
              console.log(`[C3XX-ONU-SNMP]     PON Index: ${ponIndex} -> frame: ${frame}, slot: ${slot}, port: ${port}, onuId: ${onuId} (from PON Index)`)
            }
          }
        }
      }
    }
    
    // Step 2: Walk OID lainnya untuk mendapatkan data lengkap
    console.log(`[C3XX-ONU-SNMP] Step 2: Walking other OIDs for complete data...`)
    const [onuStatusResults, onuSerialResults, onuRxResults, onuTxResults] = await Promise.all([
      walkWithDelay('1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3', 0), // Status
      walkWithDelay('1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.4', 0), // Serial Number
      walkWithDelay('1.3.6.1.4.1.3902.1082.30.40.2.4.1.3', 0),    // RX Power (OLT receive)
      walkWithDelay('1.3.6.1.4.1.3902.1082.30.40.2.4.1.4', 0),    // TX Power (ONU transmit)
    ])
    
    console.log(`[C3XX-ONU-SNMP] Status: ${onuStatusResults.length}, Serial: ${onuSerialResults.length}, RX: ${onuRxResults.length}, TX: ${onuTxResults.length}`)
    
    // Step 3: Parse semua data dan gabungkan
    console.log(`[C3XX-ONU-SNMP] Step 3: Parsing and combining data...`)
    const onuMap = new Map<string, any>()
    
    // Helper function untuk extract frame/slot/port/onuId dari OID
    // Format OID: baseOid.{PON_INDEX}.{ONU_ID}
    // PON_INDEX = (frame << 24) + (slot << 16) + (port << 8) + (onuId_from_pon_index)
    // ONU_ID di bagian terakhir adalah ONU ID yang sebenarnya
    const extractOnuInfoFromOid = (oid: string, baseOid: string): { frame: number; slot: number; port: number; onuId: number; ponIndex: number } | null => {
      const oidParts = oid.split('.')
      const baseParts = baseOid.split('.')
      
      // Minimal harus ada baseOid + PON_INDEX
      if (oidParts.length <= baseParts.length) {
        return null
      }
      
      // Ambil PON Index dari bagian pertama setelah base OID
      const ponIndexStr = oidParts[baseParts.length]
      const ponIndex = parseInt(ponIndexStr)
      
      if (isNaN(ponIndex)) {
        return null
      }
      
      // Convert PON Index ke Frame/Slot/Port
      // PON Index encode: (frame << 24) + (slot << 16) + (port << 8) + (onuId_from_pon_index)
      const frame = (ponIndex >> 24) & 0xFF
      const slot = (ponIndex >> 16) & 0xFF
      const port = (ponIndex >> 8) & 0xFF
      const onuIdFromPonIndex = ponIndex & 0xFF
      
      // Validasi frame/slot/port
      if (slot === 0 || port === 0) {
        return null
      }
      
      // ONU ID bisa dari 2 sumber:
      // 1. Dari bagian terakhir OID (jika ada): baseOid.{PON_INDEX}.{ONU_ID}
      // 2. Dari PON Index (jika tidak ada bagian terakhir): baseOid.{PON_INDEX}
      let onuId = onuIdFromPonIndex
      
      // Jika ada bagian setelah PON Index, gunakan sebagai ONU ID
      if (oidParts.length > baseParts.length + 1) {
        const onuIdStr = oidParts[oidParts.length - 1] // Ambil bagian terakhir
        const onuIdFromOid = parseInt(onuIdStr)
        if (!isNaN(onuIdFromOid) && onuIdFromOid > 0) {
          onuId = onuIdFromOid
        }
      }
      
      // Validasi ONU ID
      if (onuId === 0) {
        return null
      }
      
      return {
        frame: frame === 0 ? 1 : frame, // Default frame ke 1 jika 0
        slot,
        port,
        onuId,
        ponIndex,
      }
    }
    
    // Parse ONU Name - ini adalah data utama
    let parsedCount = 0
    let skippedCount = 0
    let skippedReasons: { [key: string]: number } = {}
    
    for (const result of onuNameResults) {
      // Extract frame/slot/port/onuId dari OID
      const onuInfo = extractOnuInfoFromOid(result.oid, onuNameOid)
      
      if (!onuInfo) {
        skippedCount++
        skippedReasons['invalid_oid_format'] = (skippedReasons['invalid_oid_format'] || 0) + 1
        if (parsedCount + skippedCount <= 5) {
          console.log(`[C3XX-ONU-SNMP] Skipped OID (invalid format): ${result.oid}`)
        }
        continue
      }
      
      const { frame, slot, port: portNum, onuId, ponIndex } = onuInfo
      const gponOnu = `${frame}/${slot}/${portNum}:${onuId}`
      const key = gponOnu
      
      // Get ONU name value
      let value = result.value
      if (Buffer.isBuffer(value)) {
        try {
          value = value.toString('utf8')
        } catch (e) {
          value = value.toString()
        }
      }
      const onuName = String(value || '').trim() || `ONU-${gponOnu}`
      
      // Create ONU entry
      if (!onuMap.has(key)) {
        onuMap.set(key, {
          frame,
          slot,
          port: portNum,
          onuId,
          gponOnu,
          name: onuName,
          description: '',
          status: 'Unknown',
          serialNumber: '',
          rxOlt: null,
          rxOnu: null,
          actualType: '',
          ponIndex, // Simpan PON Index untuk matching dengan OID lainnya
        })
        parsedCount++
        if (parsedCount <= 10) {
          console.log(`[C3XX-ONU-SNMP] Parsed ONU: ${gponOnu} (${onuName}) from OID: ${result.oid}, PON Index: ${ponIndex}`)
        }
      } else {
        onuMap.get(key)!.name = onuName
      }
    }
    
    console.log(`[C3XX-ONU-SNMP] Created ${onuMap.size} ONU entries from ${onuNameResults.length} name results`)
    console.log(`[C3XX-ONU-SNMP] Parsed: ${parsedCount}, Skipped: ${skippedCount}`)
    if (skippedCount > 0) {
      console.log(`[C3XX-ONU-SNMP] Skip reasons:`, skippedReasons)
      // Log beberapa OID yang di-skip untuk debugging
      let skipLogCount = 0
      for (const result of onuNameResults) {
        const onuInfo = extractOnuInfoFromOid(result.oid, onuNameOid)
        if (!onuInfo && skipLogCount < 10) {
          console.log(`[C3XX-ONU-SNMP] Skipped OID: ${result.oid}`)
          skipLogCount++
        }
      }
    }
    
    // Pastikan semua ONU name results ter-create
    if (onuMap.size < onuNameResults.length) {
      console.warn(`[C3XX-ONU-SNMP] WARNING: Only ${onuMap.size} ONUs created from ${onuNameResults.length} name results!`)
      console.warn(`[C3XX-ONU-SNMP] Missing ${onuNameResults.length - onuMap.size} ONUs - possible duplicate keys or parsing errors`)
      
      // Log semua keys yang sudah ada untuk debugging
      const existingKeys = Array.from(onuMap.keys())
      console.log(`[C3XX-ONU-SNMP] Existing ONU keys (first 20):`, existingKeys.slice(0, 20))
    }
    
    // Parse ONU Status
    for (const result of onuStatusResults) {
      const onuInfo = extractOnuInfoFromOid(result.oid, '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3')
      if (!onuInfo) continue
      
      const key = `${onuInfo.frame}/${onuInfo.slot}/${onuInfo.port}:${onuInfo.onuId}`
      if (!onuMap.has(key)) continue
      
      let value = result.value
      if (Buffer.isBuffer(value)) {
        value = parseInt(value.toString('hex'), 16) || value.readUInt8(0)
      }
      
      const statusId = saveint(value)
      if (statusId >= 0 && statusId < C3XX_ONU_STATUS.length) {
        const status = C3XX_ONU_STATUS[statusId]
        if (status === 'working') onuMap.get(key)!.status = 'Online'
        else if (status === 'los') onuMap.get(key)!.status = 'LOS'
        else if (status === 'dyingGasp') onuMap.get(key)!.status = 'DyingGasp'
        else if (status === 'authFailed') onuMap.get(key)!.status = 'AuthFailed'
        else if (status === 'offline') onuMap.get(key)!.status = 'OffLine'
        else onuMap.get(key)!.status = status.charAt(0).toUpperCase() + status.slice(1)
      }
    }
    
    // Parse Serial Number
    for (const result of onuSerialResults) {
      const onuInfo = extractOnuInfoFromOid(result.oid, '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.4')
      if (!onuInfo) continue
      
      const key = `${onuInfo.frame}/${onuInfo.slot}/${onuInfo.port}:${onuInfo.onuId}`
      if (!onuMap.has(key)) continue
      
      let value = result.value
      if (Buffer.isBuffer(value)) {
        try {
          value = value.toString('utf8')
        } catch (e) {
          value = value.toString()
        }
      }
      
      onuMap.get(key)!.serialNumber = String(value || '').trim()
    }
    
    // Parse RX Power (OLT receive from ONU)
    // Format OID: 1.3.6.1.4.1.3902.1082.30.40.2.4.1.3.{PON_INDEX} (tanpa ONU_ID di akhir)
    // PON_INDEX = (frame << 24) + (slot << 16) + (port << 8) + (onuId_from_pon_index)
    // Tapi ONU_ID dari PON_INDEX mungkin tidak akurat, jadi kita match berdasarkan frame/slot/port saja
    // dan assign ke semua ONU di port tersebut (atau ONU pertama jika hanya 1)
    for (const result of onuRxResults) {
      const oidParts = result.oid.split('.')
      const baseOid = '1.3.6.1.4.1.3902.1082.30.40.2.4.1.3'
      const baseParts = baseOid.split('.')
      
      // Format: baseOid.{PON_INDEX} (tanpa ONU_ID)
      if (oidParts.length <= baseParts.length) continue
      
      const ponIndexStr = oidParts[baseParts.length]
      const ponIndex = parseInt(ponIndexStr)
      if (isNaN(ponIndex)) continue
      
      // Extract frame/slot/port dari PON_INDEX
      const frame = (ponIndex >> 24) & 0xFF
      const slot = (ponIndex >> 16) & 0xFF
      const port = (ponIndex >> 8) & 0xFF
      const onuIdFromPonIndex = ponIndex & 0xFF
      
      if (slot === 0 || port === 0) continue
      
      const frameNum = frame === 0 ? 1 : frame
      
      // Match dengan ONU berdasarkan frame/slot/port
      // Jika ada ONU_ID dari PON_INDEX dan valid, coba match dengan ONU_ID tersebut
      // Jika tidak, assign ke ONU pertama di port tersebut
      let matchedKey: string | null = null
      
      if (onuIdFromPonIndex > 0 && onuIdFromPonIndex <= 128) {
        // Coba match dengan ONU_ID dari PON_INDEX
        const tryKey = `${frameNum}/${slot}/${port}:${onuIdFromPonIndex}`
        if (onuMap.has(tryKey)) {
          matchedKey = tryKey
        }
      }
      
      // Jika tidak match, cari ONU pertama di port tersebut
      if (!matchedKey) {
        for (const [key, onu] of onuMap.entries()) {
          if (onu.frame === frameNum && onu.slot === slot && onu.port === port) {
            matchedKey = key
            break // Ambil ONU pertama di port tersebut
          }
        }
      }
      
      if (!matchedKey) continue
      
      let value = result.value
      if (Buffer.isBuffer(value)) {
        value = parseInt(value.toString('hex'), 16) || value.readUInt32BE(0)
      }
      
      const rxValue = saveint(value)
      const rxDbm = convertC3xxRxValue(rxValue)
      onuMap.get(matchedKey)!.rxOlt = rxDbm === -40.0 ? null : `${rxDbm} dBm`
    }
    
    // Parse TX Power (ONU transmit)
    // Format OID: 1.3.6.1.4.1.3902.1082.30.40.2.4.1.4.{PON_INDEX} (tanpa ONU_ID di akhir)
    for (const result of onuTxResults) {
      const oidParts = result.oid.split('.')
      const baseOid = '1.3.6.1.4.1.3902.1082.30.40.2.4.1.4'
      const baseParts = baseOid.split('.')
      
      // Format: baseOid.{PON_INDEX} (tanpa ONU_ID)
      if (oidParts.length <= baseParts.length) continue
      
      const ponIndexStr = oidParts[baseParts.length]
      const ponIndex = parseInt(ponIndexStr)
      if (isNaN(ponIndex)) continue
      
      // Extract frame/slot/port dari PON_INDEX
      const frame = (ponIndex >> 24) & 0xFF
      const slot = (ponIndex >> 16) & 0xFF
      const port = (ponIndex >> 8) & 0xFF
      const onuIdFromPonIndex = ponIndex & 0xFF
      
      if (slot === 0 || port === 0) continue
      
      const frameNum = frame === 0 ? 1 : frame
      
      // Match dengan ONU berdasarkan frame/slot/port
      let matchedKey: string | null = null
      
      if (onuIdFromPonIndex > 0 && onuIdFromPonIndex <= 128) {
        // Coba match dengan ONU_ID dari PON_INDEX
        const tryKey = `${frameNum}/${slot}/${port}:${onuIdFromPonIndex}`
        if (onuMap.has(tryKey)) {
          matchedKey = tryKey
        }
      }
      
      // Jika tidak match, cari ONU pertama di port tersebut
      if (!matchedKey) {
        for (const [key, onu] of onuMap.entries()) {
          if (onu.frame === frameNum && onu.slot === slot && onu.port === port) {
            matchedKey = key
            break // Ambil ONU pertama di port tersebut
          }
        }
      }
      
      if (!matchedKey) continue
      
      let value = result.value
      if (Buffer.isBuffer(value)) {
        value = parseInt(value.toString('hex'), 16) || value.readUInt32BE(0)
      }
      
      const txValue = saveint(value)
      const txDbm = convertC3xxTxValue(txValue)
      onuMap.get(matchedKey)!.rxOnu = txDbm === -40.0 ? null : `${txDbm} dBm`
    }
    
    // Convert map to array
    let onuIndex = 1
    for (const [key, onu] of onuMap.entries()) {
      onus.push({
        id: `onu-${oltId}-${onuIndex++}`,
        oltId,
        oltName,
        name: onu.name || `ONU-${onu.gponOnu}`,
        description: onu.description || onu.gponOnu,
        pppoe: '', // PPPoE tidak tersedia di SNMP C3XX
        gponOnu: onu.gponOnu,
        status: onu.status || 'Unknown',
        rxOlt: onu.rxOlt || null,
        rxOnu: onu.rxOnu || null,
        serialNumber: onu.serialNumber || '',
        actualType: onu.actualType || detectModelFromSerial(onu.serialNumber || ''),
      })
    }
    
    console.log(`[C3XX-ONU-SNMP] Parsed ${onus.length} ONUs from ${oltName} via SNMP`)
  } catch (error: any) {
    console.error(`[C3XX-ONU-SNMP] Error fetching ONU data via SNMP:`, error)
    
    // Jika error adalah array (hasil dari snmpWalk yang di-throw), parse hasilnya
    if (Array.isArray(error) && error.length > 0) {
      console.log(`[C3XX-ONU-SNMP] Recovering from error, parsing ${error.length} results...`)
      
      try {
        // Filter untuk mendapatkan name results
        const nameResults = error.filter((r: any) => {
          const oidStr = r.oid || ''
          return oidStr.includes('500.10.2.3.3.1.2')
        })
        
        console.log(`[C3XX-ONU-SNMP] Found ${nameResults.length} name results in error recovery`)
        
        if (nameResults.length > 0) {
          const onuMap = new Map<string, any>()
          const baseOid = '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2'
          
          // Helper function untuk extract ONU info (sama dengan di atas)
          const extractOnuInfoFromOidRecovery = (oid: string, baseOid: string): { frame: number; slot: number; port: number; onuId: number } | null => {
            const oidParts = oid.split('.')
            const baseParts = baseOid.split('.')
            
            if (oidParts.length <= baseParts.length) return null
            
            const ponIndexStr = oidParts[baseParts.length]
            const ponIndex = parseInt(ponIndexStr)
            
            if (isNaN(ponIndex)) return null
            
            const frame = (ponIndex >> 24) & 0xFF
            const slot = (ponIndex >> 16) & 0xFF
            const port = (ponIndex >> 8) & 0xFF
            const onuIdFromPonIndex = ponIndex & 0xFF
            
            if (slot === 0 || port === 0) return null
            
            let onuId = onuIdFromPonIndex
            
            if (oidParts.length > baseParts.length + 1) {
              const onuIdStr = oidParts[oidParts.length - 1]
              const onuIdFromOid = parseInt(onuIdStr)
              if (!isNaN(onuIdFromOid) && onuIdFromOid > 0) {
                onuId = onuIdFromOid
              }
            }
            
            if (onuId === 0) return null
            
            return {
              frame: frame === 0 ? 1 : frame,
              slot,
              port,
              onuId,
            }
          }
          
          for (const result of nameResults) {
            const onuInfo = extractOnuInfoFromOidRecovery(result.oid, baseOid)
            if (!onuInfo) continue
            
            const { frame, slot, port: portNum, onuId } = onuInfo
            const gponOnu = `${frame}/${slot}/${portNum}:${onuId}`
            const key = gponOnu
            
            let value = result.value
            if (Buffer.isBuffer(value)) {
              value = value.toString('utf8')
            }
            const onuName = String(value || '').trim() || `ONU-${gponOnu}`
            
            if (!onuMap.has(key)) {
              onuMap.set(key, {
                frame,
                slot,
                port: portNum,
                onuId,
                gponOnu,
                name: onuName,
                description: '',
                status: 'Unknown',
                serialNumber: '',
                rxOlt: null,
                rxOnu: null,
                actualType: '',
              })
            }
          }
          
          // Convert map to array
          let onuIndex = 1
          for (const [key, onu] of onuMap.entries()) {
            onus.push({
              id: `onu-${oltId}-${onuIndex++}`,
              oltId,
              oltName,
              name: onu.name || `ONU-${onu.gponOnu}`,
              description: onu.description || onu.gponOnu,
              pppoe: '',
              gponOnu: onu.gponOnu,
              status: onu.status || 'Unknown',
              rxOlt: onu.rxOlt || null,
              rxOnu: onu.rxOnu || null,
              serialNumber: onu.serialNumber || '',
              actualType: onu.actualType || detectModelFromSerial(onu.serialNumber || ''),
            })
          }
          
          console.log(`[C3XX-ONU-SNMP] Recovered ${onus.length} ONUs from error results`)
          return onus
        }
      } catch (recoveryError) {
        console.error(`[C3XX-ONU-SNMP] Error during recovery:`, recoveryError)
      }
    }
    
    throw error
  }

  return onus
}

// Convert PON index ke format Frame/Slot/Port
// Berdasarkan kode Python teman: PON index adalah binary 32-bit yang di-decode sebagai:
// Format binary: [4 bit type][4 bit shelf][8 bit frame][8 bit slot][8 bit port]
// 
// Contoh: PON index 268632320
// Binary 32-bit: perlu convert dan parse
// PENTING: Port dimulai dari 1, bukan 0!
// Format output: Frame/Slot/Port (bukan Rack/Slot/Port)
function ponIndexToPort(ponIndex: number): string {
  // Convert ke binary 32-bit (pad dengan leading zeros)
  const binary = ponIndex.toString(2).padStart(32, '0')
  
  if (binary.length !== 32) {
    console.warn(`[All-ONU-SNMP] Invalid binary length for PON index ${ponIndex}: ${binary.length}`)
    const fallbackPort = (ponIndex % 100) || 1 // Pastikan minimal 1
    return `1/1/${fallbackPort}`
  }
  
  // Parse sesuai format: [4 bit type][4 bit shelf][8 bit frame][8 bit slot][8 bit port]
  const onuType = binary.substring(0, 4)      // bits 0-3
  const onuShelf = binary.substring(4, 8)    // bits 4-7
  const onuFrame = binary.substring(8, 16)      // bits 8-15 (Frame, bukan Rack)
  const onuSlot = binary.substring(16, 24)   // bits 16-23
  const onuPort = binary.substring(24, 32)    // bits 24-31
  
  // Convert binary ke decimal
  const frame = parseInt(onuFrame, 2) || 1 // Minimal 1 (Frame, bukan Rack)
  const slot = parseInt(onuSlot, 2) || 1 // Minimal 1
  let port = parseInt(onuPort, 2)
  
  // PORT MULAI DARI 1, BUKAN 0!
  // Jika port = 0, berarti ada masalah dengan parsing atau PON index tidak valid
  if (port === 0) {
    console.warn(`[All-ONU-SNMP] Invalid port 0 detected for PON index ${ponIndex}, skipping...`)
    // Return null atau throw error, atau skip port ini
    // Untuk sekarang, kita skip dengan return format yang jelas invalid
    return `INVALID/${slot}/0`
  }
  
  // Format: Frame/Slot/Port (bukan Rack/Slot/Port)
  // Contoh: 1/3/1, 1/4/16, dll
  return `${frame}/${slot}/${port}`
}

// Parse PON index dari OID
function parsePonIndexFromOid(oid: string, baseOid: string): number | null {
  const oidParts = oid.split('.')
  const baseParts = baseOid.split('.')
  
  if (oidParts.length < baseParts.length + 1) {
    return null
  }
  
  const ponIndex = parseInt(oidParts[baseParts.length])
  return isNaN(ponIndex) ? null : ponIndex
}

// Parse ONU ID dari OID (format: baseOid.PON.ONU_ID)
function parseOnuIdFromOid(oid: string, baseOid: string): { ponIndex: number; onuId: number } | null {
  const oidParts = oid.split('.')
  const baseParts = baseOid.split('.')
  
  if (oidParts.length < baseParts.length + 2) {
    return null
  }
  
  const ponIndex = parseInt(oidParts[baseParts.length])
  const onuId = parseInt(oidParts[baseParts.length + 1])
  
  if (isNaN(ponIndex) || isNaN(onuId)) {
    return null
  }
  
  return { ponIndex, onuId }
}

// Konversi Frame/Slot/Port ke PONID menggunakan rumus dari teman
// Rumus: PONID = (Frame * 16777216) + (Slot * 65536) + (Port * 256)
function frameSlotPortToPonId(frame: number, slot: number, port: number): number {
  return (frame * 16777216) + (slot * 65536) + (port * 256)
}

// Konversi PONID ke Frame/Slot/Port (kebalikan dari frameSlotPortToPonId)
function ponIdToFrameSlotPort(ponId: number): { frame: number; slot: number; port: number } | null {
  // Rumus: PONID = (Frame * 16777216) + (Slot * 65536) + (Port * 256)
  // Kita perlu reverse engineering
  const frame = Math.floor(ponId / 16777216)
  const remainder1 = ponId % 16777216
  const slot = Math.floor(remainder1 / 65536)
  const remainder2 = remainder1 % 65536
  const port = Math.floor(remainder2 / 256)
  
  // Validasi
  if (frame < 1 || slot < 1 || port < 1) {
    return null
  }
  
  return { frame, slot, port }
}

// Dapatkan semua PON ID aktif dari OLT menggunakan rumus SNMP
// Rumus: snmpwalk ... 1.3.6.1.4.1.3902.1012.3.28.2.1.4 | sed -n 's/.*\.\([0-9]\+\)\.[0-9]\+ =.*/\1/p' | sort -n | uniq
async function getAllActivePonIds(
  ipAddress: string,
  port: number,
  community: string,
  version: string
): Promise<number[]> {
  try {
    console.log(`[All-ONU-SNMP] Getting all active PON IDs from OLT...`)
    const results = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuStatus, 60000)
    
    // Extract semua PON ID unik dari OID
    // Format OID: 1.3.6.1.4.1.3902.1012.3.28.2.1.4.{PONID}.{ONU_ID}
    const ponIds = new Set<number>()
    
    for (const result of results) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuStatus)
      if (ponOnu) {
        ponIds.add(ponOnu.ponIndex)
      }
    }
    
    const sortedPonIds = Array.from(ponIds).sort((a, b) => a - b)
    console.log(`[All-ONU-SNMP] Found ${sortedPonIds.length} active PON IDs`)
    
    return sortedPonIds
  } catch (error) {
    console.error(`[All-ONU-SNMP] Error getting active PON IDs:`, error)
    return []
  }
}

// Get ONU data menggunakan SNMP
export async function getOnuDataViaSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltName: string,
  oltId: string
): Promise<Array<{
  id: string
  oltId: string
  oltName: string
  name: string
  description: string
  pppoe: string
  gponOnu: string
  status: string
  rxOlt: string | null
  rxOnu: string | null
  serialNumber: string
  actualType: string
}>> {
  const onus: Array<{
    id: string
    oltId: string
    oltName: string
    name: string
    description: string
    pppoe: string
    gponOnu: string
    status: string
    rxOlt: string | null
    rxOnu: string | null
    serialNumber: string
    actualType: string
  }> = []

  try {
    console.log(`[All-ONU-SNMP] Fetching ONU data from ${oltName} (${ipAddress}) via SNMP...`)
    console.log(`[All-ONU-SNMP] Using optimized SNMP formula from friend's tutorial...`)

    // Step 0: Dapatkan semua PON ID aktif menggunakan rumus SNMP
    // Rumus: snmpwalk ... 1.3.6.1.4.1.3902.1012.3.28.2.1.4 | extract PON IDs
    const activePonIds = await getAllActivePonIds(ipAddress, port, community, version)
    
    // Build mapping PON ID -> Frame/Slot/Port menggunakan rumus konversi
    // Rumus: PONID = (Frame * 16777216) + (Slot * 65536) + (Port * 256)
    const ponPortMap = new Map<number, string>()
    for (const ponId of activePonIds) {
      const portInfo = ponIdToFrameSlotPort(ponId)
      if (portInfo) {
        const portStr = `${portInfo.frame}/${portInfo.slot}/${portInfo.port}`
        ponPortMap.set(ponId, portStr)
        console.log(`[All-ONU-SNMP] PON ID ${ponId} -> ${portStr}`)
      } else {
        // Fallback ke fungsi lama jika konversi gagal
        const portStr = ponIndexToPort(ponId)
        if (!portStr.includes('INVALID')) {
          ponPortMap.set(ponId, portStr)
        }
      }
    }
    
    console.log(`[All-ONU-SNMP] Mapped ${ponPortMap.size} PON IDs to Frame/Slot/Port format`)

    // Step 1: Get all ONU statuses (berdasarkan script bash)
    // OID: 1.3.6.1.4.1.3902.1012.3.28.2.1.4.{PON}.{ONU_ID}
    // Rumus: snmpwalk -v2c -c [COMMUNITY] [IP]:[PORT] 1.3.6.1.4.1.3902.1012.3.28.2.1.4.[PONID]
    const statusResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuStatus, 60000)
    console.log(`[All-ONU-SNMP] Found ${statusResults.length} status entries`)

    // Group by PON and ONU ID
    const onuMap = new Map<string, any>()

    // Parse status results
    // Format OID: baseOID.PON.ONU_ID
    // Contoh: 1.3.6.1.4.1.3902.1012.3.28.2.1.4.268632320.3
    //         baseOID = 1.3.6.1.4.1.3902.1012.3.28.2.1.4
    //         PON = 268632320
    //         ONU_ID = 3
    for (const result of statusResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuStatus)
      if (!ponOnu) {
        console.warn(`[All-ONU-SNMP] Failed to parse OID: ${result.oid}`)
        continue
      }

      // Gunakan mapping jika ada, jika tidak gunakan fungsi konversi
      let ponPort: string
      if (ponPortMap.has(ponOnu.ponIndex)) {
        ponPort = ponPortMap.get(ponOnu.ponIndex)!
      } else {
        ponPort = ponIndexToPort(ponOnu.ponIndex)
      }
      const key = `${ponPort}:${ponOnu.onuId}`
      
      if (!onuMap.has(key)) {
        onuMap.set(key, {
          ponIndex: ponOnu.ponIndex,
          ponPort,
          onuId: ponOnu.onuId,
          gponOnu: `${ponPort}:${ponOnu.onuId}`,
        })
      }

      const statusValue = typeof result.value === 'number' ? result.value : parseInt(String(result.value))
      // Status: 1=LOS, 3=Online, 4=DyingGasp, 6=OffLine
      if (statusValue === 1) onuMap.get(key)!.status = 'LOS'
      else if (statusValue === 3) onuMap.get(key)!.status = 'Online'
      else if (statusValue === 4) onuMap.get(key)!.status = 'DyingGasp'
      else if (statusValue === 6) onuMap.get(key)!.status = 'OffLine'
      else onuMap.get(key)!.status = 'Unknown'
    }

    // Step 2: Get serial numbers, RX values, types, names, descriptions
    const serialResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuSerial, 30000)
    const rxOltResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuRxOlt, 30000)
    const rxOnuResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuRxOnu, 30000)
    const typeResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuType, 30000)
    const nameResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuName, 30000)
    const descResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuDescription, 30000)

    // Helper function untuk mendapatkan key dengan port mapping
    const getKeyWithPort = (ponOnu: { ponIndex: number; onuId: number }): string => {
      let ponPort: string
      if (ponPortMap.has(ponOnu.ponIndex)) {
        ponPort = ponPortMap.get(ponOnu.ponIndex)!
      } else {
        ponPort = ponIndexToPort(ponOnu.ponIndex)
      }
      return `${ponPort}:${ponOnu.onuId}`
    }

    // Parse serial numbers
    for (const result of serialResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuSerial)
      if (!ponOnu) continue

      const key = getKeyWithPort(ponOnu)
      
      if (onuMap.has(key)) {
        onuMap.get(key).serialNumber = result.value?.toString() || ''
      }
    }

    // Parse RX OLT (dalam 0.01 dBm, jadi perlu dibagi 100)
    for (const result of rxOltResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuRxOlt)
      if (!ponOnu) continue

      const key = getKeyWithPort(ponOnu)
      
      if (onuMap.has(key)) {
        const rxValue = typeof result.value === 'number' ? result.value : parseFloat(result.value)
        if (!isNaN(rxValue)) {
          // Convert dari 0.01 dBm ke dBm
          const rxDbm = (rxValue / 100).toFixed(3)
          onuMap.get(key).rxOlt = `${rxDbm} dBm`
        }
      }
    }

    // Parse RX ONU
    for (const result of rxOnuResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuRxOnu)
      if (!ponOnu) continue

      const key = getKeyWithPort(ponOnu)
      
      if (onuMap.has(key)) {
        const rxValue = typeof result.value === 'number' ? result.value : parseFloat(result.value)
        if (!isNaN(rxValue)) {
          const rxDbm = (rxValue / 100).toFixed(3)
          onuMap.get(key).rxOnu = `${rxDbm} dBm`
        }
      }
    }

    // Parse types
    for (const result of typeResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuType)
      if (!ponOnu) continue

      const key = getKeyWithPort(ponOnu)
      
      if (onuMap.has(key)) {
        onuMap.get(key).actualType = result.value?.toString() || ''
      }
    }

    // Parse names
    for (const result of nameResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuName)
      if (!ponOnu) continue

      let ponPort: string
      if (ponPortMap.has(ponOnu.ponIndex)) {
        ponPort = ponPortMap.get(ponOnu.ponIndex)!
      } else {
        ponPort = ponIndexToPort(ponOnu.ponIndex)
      }
      const key = `${ponPort}:${ponOnu.onuId}`
      
      const nameValue = result.value?.toString() || ''
      
      // Update port mapping jika ditemukan di name
      const portMatch = nameValue.match(/(\d+\/\d+\/\d+):(\d+)/)
      if (portMatch && parseInt(portMatch[2]) === ponOnu.onuId) {
        ponPortMap.set(ponOnu.ponIndex, portMatch[1])
        // Update key dengan port yang benar
        const correctPort = portMatch[1]
        const correctKey = `${correctPort}:${ponOnu.onuId}`
        
        // Jika key berbeda, pindahkan data
        if (key !== correctKey) {
          if (onuMap.has(key)) {
            const oldData = onuMap.get(key)!
            onuMap.delete(key)
            onuMap.set(correctKey, {
              ...oldData,
              ponPort: correctPort,
              gponOnu: `${correctPort}:${ponOnu.onuId}`,
              name: nameValue,
            })
          } else if (!onuMap.has(correctKey)) {
            // Buat entry baru jika belum ada
            onuMap.set(correctKey, {
              ponIndex: ponOnu.ponIndex,
              ponPort: correctPort,
              onuId: ponOnu.onuId,
              gponOnu: `${correctPort}:${ponOnu.onuId}`,
              name: nameValue,
              description: '',
              pppoe: '',
              status: 'Unknown',
              rxOlt: null,
              rxOnu: null,
              serialNumber: '',
              actualType: '',
            })
          } else {
            onuMap.get(correctKey)!.name = nameValue
          }
        } else {
          if (onuMap.has(key)) {
            onuMap.get(key)!.name = nameValue
          }
        }
      } else {
        // Jika tidak ada port di name, gunakan key yang sudah ada
        if (onuMap.has(key)) {
          onuMap.get(key)!.name = nameValue
        }
      }
    }

    // Parse descriptions
    for (const result of descResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuDescription)
      if (!ponOnu) continue

      let ponPort: string
      if (ponPortMap.has(ponOnu.ponIndex)) {
        ponPort = ponPortMap.get(ponOnu.ponIndex)!
      } else {
        ponPort = ponIndexToPort(ponOnu.ponIndex)
      }
      const key = `${ponPort}:${ponOnu.onuId}`
      
      const descValue = result.value?.toString() || ''
      
      // Update port mapping jika ditemukan di description
      const portMatch = descValue.match(/(\d+\/\d+\/\d+):(\d+)/)
      if (portMatch && parseInt(portMatch[2]) === ponOnu.onuId) {
        ponPortMap.set(ponOnu.ponIndex, portMatch[1])
        // Update key dengan port yang benar
        const correctPort = portMatch[1]
        const correctKey = `${correctPort}:${ponOnu.onuId}`
        
        // Jika key berbeda, pindahkan data
        if (key !== correctKey) {
          if (onuMap.has(key)) {
            const oldData = onuMap.get(key)!
            onuMap.delete(key)
            onuMap.set(correctKey, {
              ...oldData,
              ponPort: correctPort,
              gponOnu: `${correctPort}:${ponOnu.onuId}`,
              description: descValue,
            })
          } else if (!onuMap.has(correctKey)) {
            // Buat entry baru jika belum ada
            onuMap.set(correctKey, {
              ponIndex: ponOnu.ponIndex,
              ponPort: correctPort,
              onuId: ponOnu.onuId,
              gponOnu: `${correctPort}:${ponOnu.onuId}`,
              name: '',
              description: descValue,
              pppoe: '',
              status: 'Unknown',
              rxOlt: null,
              rxOnu: null,
              serialNumber: '',
              actualType: '',
            })
          } else {
            onuMap.get(correctKey)!.description = descValue
          }
        } else {
          if (onuMap.has(key)) {
            onuMap.get(key)!.description = descValue
          }
        }
      } else {
        // Jika tidak ada port di description, gunakan key yang sudah ada
        if (onuMap.has(key)) {
          onuMap.get(key)!.description = descValue
        }
      }
    }

    // Convert map to array
    let onuIndex = 1
    for (const [key, onu] of onuMap.entries()) {
      onus.push({
        id: `onu-${oltId}-${onuIndex++}`,
        oltId,
        oltName,
        name: onu.name || `ONU-${onu.gponOnu}`,
        description: onu.description || onu.gponOnu,
        pppoe: '', // PPPoE biasanya tidak ada di SNMP, perlu dari config atau Telnet
        gponOnu: onu.gponOnu,
        status: onu.status || 'Unknown',
        rxOlt: onu.rxOlt || null,
        rxOnu: onu.rxOnu || null,
        serialNumber: onu.serialNumber || '',
        actualType: onu.actualType || detectModelFromSerial(onu.serialNumber || ''),
      })
    }

    console.log(`[All-ONU-SNMP] Parsed ${onus.length} ONUs from ${oltName} via SNMP`)
  } catch (error: any) {
    console.error(`[All-ONU-SNMP] Error fetching ONU data via SNMP:`, error)
    // Jika error adalah array (hasil dari snmpWalk), itu sebenarnya bukan error
    // tapi hasil yang di-throw karena callback issue
    if (Array.isArray(error) && error.length > 0) {
      // Ini sebenarnya hasil, bukan error
      // Parse hasil ini sebagai status results
      const statusResults = error
      const onuMap = new Map<string, any>()
      
      for (const result of statusResults) {
        const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuStatus)
        if (!ponOnu) continue

        const ponPort = ponIndexToPort(ponOnu.ponIndex)
        const key = `${ponPort}:${ponOnu.onuId}`
        
        if (!onuMap.has(key)) {
          onuMap.set(key, {
            ponIndex: ponOnu.ponIndex,
            ponPort,
            onuId: ponOnu.onuId,
            gponOnu: `${ponPort}:${ponOnu.onuId}`,
            status: 'Unknown',
          })
        }

        const statusValue = typeof result.value === 'number' ? result.value : parseInt(String(result.value))
        if (statusValue === 1) onuMap.get(key)!.status = 'LOS'
        else if (statusValue === 3) onuMap.get(key)!.status = 'Online'
        else if (statusValue === 4) onuMap.get(key)!.status = 'DyingGasp'
        else if (statusValue === 6) onuMap.get(key)!.status = 'OffLine'
        else onuMap.get(key)!.status = 'Unknown'
      }

      // Convert map to array dengan data minimal
      let onuIndex = 1
      for (const [key, onu] of onuMap.entries()) {
        onus.push({
          id: `onu-${oltId}-${onuIndex++}`,
          oltId,
          oltName,
          name: onu.name || `ONU-${onu.gponOnu}`,
          description: onu.description || onu.gponOnu,
          pppoe: '',
          gponOnu: onu.gponOnu,
          status: onu.status || 'Unknown',
          rxOlt: null,
          rxOnu: null,
          serialNumber: '',
          actualType: '',
        })
      }

      console.log(`[All-ONU-SNMP] Parsed ${onus.length} ONUs from ${oltName} via SNMP (from error recovery)`)
      return onus
    }
    throw error
  }

  return onus
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
    console.log(`[All-ONU] Connecting to ${ipAddress}:${port}...`)

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
    console.log('[All-ONU] Connected, waiting for login...')

    // Tunggu login selesai dan prompt muncul
    let loginBuffer = ''
    let loginComplete = false
    let loginCheckCount = 0

    connection.on('data', (data: Buffer) => {
      const text = data.toString()
      loginBuffer += text
    })

    // Tunggu prompt muncul (max 10 detik)
    while (!loginComplete && loginCheckCount < 20) {
      await new Promise((r) => setTimeout(r, 500))
      loginCheckCount++
      
      if (/[A-Z0-9-]+[#>]\s*$/.test(loginBuffer) || /[#>]\s*$/.test(loginBuffer)) {
        loginComplete = true
        console.log('[All-ONU] Login completed, prompt detected')
        break
      }
    }

    if (!loginComplete) {
      console.warn('[All-ONU] Login timeout, but proceeding anyway...')
    }

    // Clear buffer dan setup untuk command output
    let outputBuffer = ''
    connection.removeAllListeners('data')
    
    connection.on('data', (data: Buffer) => {
      const text = data.toString()
      outputBuffer += text
    })

    await new Promise((r) => setTimeout(r, 500))

    console.log(`[All-ONU] Sending command: ${command}`)
    await connection.send(command + '\r\n')

    let pageCount = 0
    let lastOutputLength = 0
    let stableCount = 0

    while (true) {
      await new Promise((r) => setTimeout(r, 500))

      if (/--More--/i.test(outputBuffer)) {
        pageCount++
        console.log(`[All-ONU] Paging detected (page ${pageCount}), sending space...`)
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
            console.log('[All-ONU] Output complete, prompt detected')
            break
          }
        }
      } else {
        stableCount = 0
        lastOutputLength = outputBuffer.length
      }

      if (pageCount > 100 || outputBuffer.length > 5_000_000) {
        console.warn('[All-ONU] Safety limit reached')
        break
      }
    }

    console.log(`[All-ONU] Command completed, total output: ${outputBuffer.length} chars`)

    const cleaned = outputBuffer
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

    connection.end()
    return result
  } catch (error: any) {
    console.error('[All-ONU] Error:', error)
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
    // ZTE ONU - bisa F660, F609, dll
    // Coba deteksi dari panjang atau pola serial
    if (upperSerial.length >= 12) {
      // Biasanya F609V3.0 atau F660
      return 'F609V3.0' // Default, bisa disesuaikan
    }
    return 'ZTE-ONU'
  } else if (upperSerial.startsWith('HWTC') || upperSerial.startsWith('FHTT')) {
    // Huawei ONU - bisa HG8245, HG8145, HG6243, HG6145, dll
    return 'HG8245' // Default, bisa disesuaikan
  }
  
  return 'Unknown'
}

// Parse ONU data dari output command show gpon onu state
function parseOnuData(output: string, oltName: string, oltId: string): Array<{
  id: string
  oltId: string
  oltName: string
  name: string
  description: string
  pppoe: string
  gponOnu: string
  status: string
  rxOlt: string | null
  rxOnu: string | null
  serialNumber: string
  actualType: string
}> {
  const onus: Array<{
    id: string
    oltId: string
    oltName: string
    name: string
    description: string
    pppoe: string
    gponOnu: string
    status: string
    rxOlt: string | null
    rxOnu: string | null
    serialNumber: string
    actualType: string
  }> = []

  const lines = output.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
  
  let onuIndex = 1
  let currentOnu: any = null

  // Parse format output show gpon onu state
  // Format bisa berbeda-beda tergantung OLT, tapi umumnya:
  // gpon-onu_1/3/1:1
  //   State: online
  //   Serial: RTEGC6099704
  //   RX OLT: -26.471 dBm
  //   RX ONU: -24.95 dBm
  //   Name: ONU-8:15-Siti Maesaroh
  //   Description: ONU-8:15
  //   PPPoE: SitiMaesaroh@sblnet.id
  //   Type: F609V3.0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Cek apakah ini baris dengan format gpon-onu_X/Y/Z:N atau X/Y/Z:N
    const onuHeaderMatch = line.match(/gpon-onu_(\d+\/\d+\/\d+):(\d+)/i) || line.match(/^(\d+\/\d+\/\d+):(\d+)/)
    if (onuHeaderMatch) {
      // Skip jika ini header table
      if (line.includes('OnuIndex') || line.includes('State') || line.includes('Serial') || line.match(/^-+$/)) {
        continue
      }
      
      // Simpan ONU sebelumnya jika ada
      if (currentOnu) {
        onus.push({
          id: `onu-${oltId}-${onuIndex++}`,
          oltId,
          oltName,
          name: currentOnu.name || `ONU-${currentOnu.gponOnu}`,
          description: currentOnu.description || currentOnu.gponOnu,
          pppoe: currentOnu.pppoe || '',
          gponOnu: currentOnu.gponOnu,
          status: currentOnu.status || 'Unknown',
          rxOlt: currentOnu.rxOlt || null,
          rxOnu: currentOnu.rxOnu || null,
          serialNumber: currentOnu.serialNumber || '',
          actualType: currentOnu.actualType || detectModelFromSerial(currentOnu.serialNumber || ''),
        })
      }

      // Mulai ONU baru
      const port = onuHeaderMatch[1]
      const onuId = onuHeaderMatch[2]
      currentOnu = {
        gponOnu: `${port}:${onuId}`,
        name: '',
        description: '',
        pppoe: '',
        status: 'Unknown',
        rxOlt: null,
        rxOnu: null,
        serialNumber: '',
        actualType: '',
      }
      continue
    }

    // Parse field-field ONU
    if (currentOnu) {
      // State/Status
      if (/state\s*:?\s*(online|offline|dyinggasp|los|unknown)/i.test(line)) {
        const match = line.match(/state\s*:?\s*(\w+)/i)
        if (match) {
          const status = match[1].toLowerCase()
          if (status === 'online') currentOnu.status = 'Online'
          else if (status === 'dyinggasp') currentOnu.status = 'DyingGasp'
          else if (status === 'los') currentOnu.status = 'LOS'
          else currentOnu.status = status.charAt(0).toUpperCase() + status.slice(1)
        }
      }

      // Serial Number
      if (/serial\s*:?\s*([A-Z0-9]{12,})/i.test(line)) {
        const match = line.match(/serial\s*:?\s*([A-Z0-9]{12,})/i)
        if (match) {
          currentOnu.serialNumber = match[1].toUpperCase()
          if (!currentOnu.actualType) {
            currentOnu.actualType = detectModelFromSerial(currentOnu.serialNumber)
          }
        }
      }

      // RX OLT
      if (/rx\s+olt\s*:?\s*([-\d.]+)\s*d?b?m?/i.test(line)) {
        const match = line.match(/rx\s+olt\s*:?\s*([-\d.]+)\s*d?b?m?/i)
        if (match) {
          currentOnu.rxOlt = `${match[1]} dBm`
        }
      }

      // RX ONU
      if (/rx\s+onu\s*:?\s*([-\d.]+)\s*d?b?m?/i.test(line)) {
        const match = line.match(/rx\s+onu\s*:?\s*([-\d.]+)\s*d?b?m?/i)
        if (match) {
          currentOnu.rxOnu = `${match[1]} dBm`
        }
      }

      // Name
      if (/name\s*:?\s*(.+)/i.test(line) && !line.includes('RX') && !line.includes('Serial')) {
        const match = line.match(/name\s*:?\s*(.+)/i)
        if (match) {
          currentOnu.name = match[1].trim()
        }
      }

      // Description
      if (/description\s*:?\s*(.+)/i.test(line)) {
        const match = line.match(/description\s*:?\s*(.+)/i)
        if (match) {
          currentOnu.description = match[1].trim()
        }
      }

      // PPPoE
      if (/pppoe\s*:?\s*(.+)/i.test(line)) {
        const match = line.match(/pppoe\s*:?\s*(.+)/i)
        if (match) {
          currentOnu.pppoe = match[1].trim()
        }
      }

      // Type/Actual Type
      if (/(type|actual\s+type)\s*:?\s*(.+)/i.test(line)) {
        const match = line.match(/(type|actual\s+type)\s*:?\s*(.+)/i)
        if (match) {
          currentOnu.actualType = match[2].trim()
        }
      }
    }
  }

  // Simpan ONU terakhir jika ada
  if (currentOnu) {
    onus.push({
      id: `onu-${oltId}-${onuIndex++}`,
      oltId,
      oltName,
      name: currentOnu.name || `ONU-${currentOnu.gponOnu}`,
      description: currentOnu.description || currentOnu.gponOnu,
      pppoe: currentOnu.pppoe || '',
      gponOnu: currentOnu.gponOnu,
      status: currentOnu.status || 'Unknown',
      rxOlt: currentOnu.rxOlt || null,
      rxOnu: currentOnu.rxOnu || null,
      serialNumber: currentOnu.serialNumber || '',
      actualType: currentOnu.actualType || detectModelFromSerial(currentOnu.serialNumber || ''),
    })
  }

  console.log(`[All-ONU] Parsed ${onus.length} ONUs from ${oltName}`)
  return onus
}

// Helper function untuk menghitung summary
function calculateSummary(allOnus: Array<{
  status: string
  rxOlt: string | null
  rxOnu: string | null
}>) {
  let goodCount = 0
  let warningCount = 0
  let criticalCount = 0
  let otherCount = 0
  let goodRxOlt = 0
  let goodRxOnu = 0
  let warningRxOlt = 0
  let warningRxOnu = 0
  let criticalRxOlt = 0
  let criticalRxOnu = 0
  let losCount = 0
  let naCount = 0

  for (const onu of allOnus) {
    const rxOlt = onu.rxOlt ? parseFloat(onu.rxOlt.replace(/[^\d.-]/g, '')) : null
    const rxOnu = onu.rxOnu ? parseFloat(onu.rxOnu.replace(/[^\d.-]/g, '')) : null

    if (onu.status === 'LOS' || onu.status === 'DyingGasp') {
      otherCount++
      if (onu.status === 'LOS') losCount++
      else naCount++
    } else if (rxOlt !== null) {
      if (rxOlt >= -26.0) {
        goodCount++
        goodRxOlt++
        if (rxOnu !== null) goodRxOnu++
      } else if (rxOlt >= -28.0) {
        warningCount++
        warningRxOlt++
        if (rxOnu !== null) warningRxOnu++
      } else {
        criticalCount++
        criticalRxOlt++
        if (rxOnu !== null) criticalRxOnu++
      }
    } else {
      otherCount++
      naCount++
    }
  }

  const total = allOnus.length
  return {
    good: {
      count: goodCount,
      percentage: total > 0 ? (goodCount / total) * 100 : 0,
      rxOlt: goodRxOlt,
      rxOnu: goodRxOnu,
    },
    warning: {
      count: warningCount,
      percentage: total > 0 ? (warningCount / total) * 100 : 0,
      rxOlt: warningRxOlt,
      rxOnu: warningRxOnu,
    },
    critical: {
      count: criticalCount,
      percentage: total > 0 ? (criticalCount / total) * 100 : 0,
      rxOlt: criticalRxOlt,
      rxOnu: criticalRxOnu,
    },
    other: {
      count: otherCount,
      percentage: total > 0 ? (otherCount / total) * 100 : 0,
      los: losCount,
      na: naCount,
    },
  }
}

// Catatan: Error "req.doneCb is not a function" adalah bug internal dari library net-snmp
// yang terjadi ketika callback dipanggil setelah session ditutup.
// Error ini sudah ditangani melalui Promise.allSettled dan error recovery di getC3xxOnuDataViaSNMP.
// Data ONU tetap berhasil di-parse meskipun error ini muncul di console.

// DELETE endpoint untuk hapus semua data ONU
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Hapus langsung dari Prisma
    const { prisma } = await import('@/lib/prisma')
    
    // Hitung dulu sebelum hapus
    const count = await prisma.onu.count()
    
    // Hapus semua ONU dari database
    await prisma.onu.deleteMany({})
    
    console.log(`[All-ONU] Deleted all ${count} ONUs from database`)
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${count} ONUs from database`,
      deletedCount: count,
    })
  } catch (error: any) {
    console.error('[All-ONU] Error deleting all ONUs:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete ONUs',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Logika untuk "all onu" dinonaktifkan - return empty array
  console.log('[All-ONU] Feature disabled - returning empty data')
  
  return NextResponse.json({
    onus: [],
    summary: {
      good: { count: 0, percentage: 0, rxOlt: 0, rxOnu: 0 },
      warning: { count: 0, percentage: 0, rxOlt: 0, rxOnu: 0 },
      critical: { count: 0, percentage: 0, rxOlt: 0, rxOnu: 0 },
      other: { count: 0, percentage: 0, los: 0, na: 0 },
    },
    total: 0,
    source: null,
  })
}

// Kode di bawah ini dinonaktifkan - logika untuk fetch ONU dari SNMP/Telnet
/*
  try {
    // Jika tidak force refresh, coba ambil dari database terlebih dahulu
    if (!forceRefresh) {
      console.log('[All-ONU] Loading ONU data from database...')
      const dbOnus = await onuRepository.findAll()
      
      if (dbOnus.length > 0) {
        // Convert database format ke format API
        const allOnus = dbOnus.map((onu) => ({
          id: onu.id,
          oltId: onu.oltId,
          oltName: allOlts.find((olt) => olt.id === onu.oltId)?.name || 'Unknown',
          name: onu.name,
          description: onu.description || '',
          pppoe: onu.pppoe || '',
          gponOnu: onu.gponOnu,
          status: onu.status,
          rxOlt: onu.rxOlt,
          rxOnu: onu.rxOnu,
          serialNumber: onu.serialNumber || '',
          actualType: onu.actualType || '',
        }))

        // Hitung summary
        const summary = calculateSummary(allOnus)
        
        console.log(`[All-ONU] Loaded ${allOnus.length} ONUs from database`)
        return NextResponse.json({
          onus: allOnus,
          summary,
          total: allOnus.length,
          source: 'database',
        })
      } else {
        console.log('[All-ONU] No data in database, fetching from SNMP...')
      }
    } else {
      console.log('[All-ONU] Force refresh requested, fetching from SNMP...')
    }

    // Fallback ke SNMP jika database kosong atau force refresh
    const allOnus: Array<{
      id: string
      oltId: string
      oltName: string
      name: string
      description: string
      pppoe: string
      gponOnu: string
      status: string
      rxOlt: string | null
      rxOnu: string | null
      serialNumber: string
      actualType: string
    }> = []

    // Untuk setiap OLT, ambil data ONU
    for (const olt of connectedOlts) {
      try {
        // Prioritaskan SNMP jika tersedia (lebih cepat dan efisien)
        if (olt.snmpConnected && olt.snmpCommunityWrite) {
          console.log(`[All-ONU] Using SNMP for OLT ${olt.name} (${olt.ipAddress})...`)
          
          // Deteksi apakah ini ZTE C3XX
          const isC3xx = await isZteC3xx(
            olt.ipAddress,
            olt.snmpPort,
            olt.snmpCommunityWrite,
            olt.snmpVersion
          )
          
          if (isC3xx) {
            console.log(`[All-ONU] Detected ZTE C3XX OLT, using C3XX parser...`)
            const onus = await getC3xxOnuDataViaSNMP(
              olt.ipAddress,
              olt.snmpPort,
              olt.snmpCommunityWrite,
              olt.snmpVersion,
              olt.name,
              olt.id
            )
            allOnus.push(...onus)
          } else {
            // Gunakan parser standar untuk ZTE OLT lainnya
            const onus = await getOnuDataViaSNMP(
              olt.ipAddress,
              olt.snmpPort,
              olt.snmpCommunityWrite,
              olt.snmpVersion,
              olt.name,
              olt.id
            )
            allOnus.push(...onus)
          }
        } else if (olt.telnetConnected && olt.telnetUsername && olt.telnetPassword) {
          // Fallback ke Telnet jika SNMP tidak tersedia
          console.log(`[All-ONU] Using Telnet for OLT ${olt.name} (${olt.ipAddress})...`)
          const command = 'show gpon onu state'
          const output = await executeTelnetCommand(
            olt.ipAddress,
            olt.telnetPort,
            olt.telnetUsername!,
            olt.telnetPassword!,
            command,
            60000
          )
          const onus = parseOnuData(output, olt.name, olt.id)
          allOnus.push(...onus)
        }
      } catch (error: any) {
        console.error(`[All-ONU] Error fetching ONUs from OLT ${olt.name}:`, error)
        // Continue dengan OLT berikutnya
      }
    }

    // Simpan data ke database jika fetch dari SNMP berhasil
    if (allOnus.length > 0) {
      console.log(`[All-ONU] Saving ${allOnus.length} ONUs to database...`)
      let savedCount = 0
      for (const onu of allOnus) {
        try {
          await onuRepository.upsert(onu.oltId, onu.gponOnu, {
            oltId: onu.oltId,
            name: onu.name,
            description: onu.description || null,
            pppoe: onu.pppoe || null,
            gponOnu: onu.gponOnu,
            status: onu.status,
            rxOlt: onu.rxOlt,
            rxOnu: onu.rxOnu,
            serialNumber: onu.serialNumber || null,
            actualType: onu.actualType || null,
          })
          savedCount++
        } catch (error: any) {
          console.error(`[All-ONU] Error saving ONU ${onu.gponOnu} to database:`, error?.message || error)
        }
      }
      console.log(`[All-ONU] Successfully saved ${savedCount}/${allOnus.length} ONUs to database`)
      
      // Update last sync time untuk setiap OLT yang berhasil di-fetch
      const oltIds = [...new Set(allOnus.map(onu => onu.oltId))]
      for (const oltId of oltIds) {
        try {
          await oltRepository.update(oltId, {
            onuLastSync: new Date(),
          })
        } catch (error: any) {
          console.error(`[All-ONU] Error updating last sync time for OLT ${oltId}:`, error?.message || error)
        }
      }
    }

    // Hitung summary
    let goodCount = 0
    let warningCount = 0
    let criticalCount = 0
    let otherCount = 0
    let goodRxOlt = 0
    let goodRxOnu = 0
    let warningRxOlt = 0
    let warningRxOnu = 0
    let criticalRxOlt = 0
    let criticalRxOnu = 0
    let losCount = 0
    let naCount = 0

    for (const onu of allOnus) {
      const rxOlt = onu.rxOlt ? parseFloat(onu.rxOlt.replace(/[^\d.-]/g, '')) : null
      const rxOnu = onu.rxOnu ? parseFloat(onu.rxOnu.replace(/[^\d.-]/g, '')) : null

      if (onu.status === 'LOS' || onu.status === 'DyingGasp') {
        otherCount++
        if (onu.status === 'LOS') losCount++
        else naCount++
      } else if (rxOlt !== null) {
        if (rxOlt >= -26.0) {
          goodCount++
          goodRxOlt++
          if (rxOnu !== null) goodRxOnu++
        } else if (rxOlt >= -28.0) {
          warningCount++
          warningRxOlt++
          if (rxOnu !== null) warningRxOnu++
        } else {
          criticalCount++
          criticalRxOlt++
          if (rxOnu !== null) criticalRxOnu++
        }
      } else {
        otherCount++
        naCount++
      }
    }

    const total = allOnus.length
    const summary = calculateSummary(allOnus)

    return NextResponse.json({
      onus: allOnus,
      summary,
      total,
      source: 'snmp',
    })
  } catch (error: any) {
    console.error('[All-ONU] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Gagal memuat data ONU',
        details: error.toString(),
      },
      { status: 500 }
    )
  }
}
*/


