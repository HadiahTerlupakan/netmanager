import { NextRequest, NextResponse } from 'next/server'
import { getOLTRepository, getOnuRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import snmp from 'net-snmp'

// Global handler untuk suppress error dari net-snmp library bug
// Handler ini hanya suppress error yang sudah diketahui dan tidak berbahaya
if (typeof process !== 'undefined' && !(global as any).__SNMP_ERROR_HANDLER_ADDED) {
  try {
    // Override console.error untuk filter out error dari net-snmp
    const originalConsoleError = console.error
    console.error = (...args: any[]) => {
      const errorStr = args.join(' ')
      // Suppress error "req.doneCb is not a function" dari net-snmp library
      if (errorStr.includes('req.doneCb is not a function')) {
        // Ignore error ini karena sudah di-handle di callback dan data tetap berhasil di-fetch
        return
      }
      // Untuk error lain, tampilkan seperti biasa
      originalConsoleError.apply(console, args)
    }
    
    // Handler untuk uncaught exception
    const snmpErrorHandler = (error: Error) => {
      // Suppress error "req.doneCb is not a function" dari net-snmp library
      if (error && error.message && error.message.includes('req.doneCb is not a function')) {
        // Ignore error ini karena sudah di-handle di callback dan data tetap berhasil di-fetch
        return
      }
      // Untuk error lain, tampilkan error
      originalConsoleError('[Uncaught Exception]', error)
    }
    
    process.on('uncaughtException', snmpErrorHandler)
    ;(global as any).__SNMP_ERROR_HANDLER_ADDED = true
  } catch (e) {
    // Ignore error saat setup handler
    console.warn('[SNMP] Failed to setup error handler:', e)
  }
}

// Helper function untuk SNMP Get (untuk single OID)
async function snmpGet(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 10000
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
          setTimeout(() => {
            try {
              if (typeof session.close === 'function') {
                session.close()
              }
            } catch (e) {
              // Ignore
            }
          }, 100)
        } catch (e) {
          // Ignore
        }
        session = null
      }
      resolve(value)
    }

    try {
      let snmpVersion: 0 | 1 | undefined = 1 // Default: Version2c
      if (version === '1') {
        snmpVersion = 0 // Version1
      } else if (version === '3') {
        snmpVersion = 1 // Fallback to Version2c
      }

      session = snmp.createSession(ipAddress, community, {
        port: port,
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
          if (snmp.isVarbindError(varbind)) {
            finish(null)
          } else if (varbind.value !== null && varbind.value !== undefined) {
            finish(varbind.value.toString())
          } else {
            finish(null)
          }
        }
      })

      timeoutId = setTimeout(() => {
        finish(null)
      }, timeout)
    } catch (error) {
      finish(null)
    }
  })
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
    let varbindsAsErrorCount = 0 // Counter untuk track bug net-snmp

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
          if (varbindsAsErrorCount > 0) {
            console.log(`[C300-GPON-SNMP] SNMP walk completed with ${results.length} results. Note: ${varbindsAsErrorCount} varbinds received as error parameter (net-snmp bug, already handled)`)
          } else {
            console.log(`[C300-GPON-SNMP] SNMP walk completed with ${results.length} results despite error: ${error.message || error}`)
          }
          resolve(results)
        } else {
          reject(error)
        }
      } else {
        if (varbindsAsErrorCount > 0) {
          console.log(`[C300-GPON-SNMP] SNMP walk completed with ${results.length} results. Note: ${varbindsAsErrorCount} varbinds received as error parameter (net-snmp bug, already handled)`)
        }
        resolve(results)
      }
    }

    try {
      let snmpVersion: 0 | 1 | undefined = 1 // Default: Version2c
      if (version === '1') {
        snmpVersion = 0 // Version1
      } else if (version === '3') {
        console.warn(`[C300-GPON-SNMP] SNMP v3 is not supported, using v2c instead`)
        snmpVersion = 1 // Fallback to Version2c
      }

      session = snmp.createSession(ipAddress, community, {
        port: port,
        version: snmpVersion,
        retries: 3,
        timeout: 10000,
      })

      // Set timeout utama
      timeoutId = setTimeout(() => {
        if (!resolved) {
          if (results.length > 0) {
            // Jika sudah ada results, tunggu lebih lama untuk memastikan tidak ada data lagi
            console.log(`[C300-GPON-SNMP] SNMP walk timeout reached with ${results.length} results, waiting 5 seconds for more data...`)
            if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
            stableCheckTimeout = setTimeout(() => {
              if (!resolved && !isClosing) {
                console.log(`[C300-GPON-SNMP] SNMP walk completed with ${results.length} results (timeout reached)`)
                finish()
              }
            }, 5000)
          } else {
            finish(new Error('SNMP walk timeout - no results'))
          }
        }
      }, timeout)

      // Check untuk stabilitas results (jika tidak ada perubahan selama 3 detik, anggap selesai)
      const checkStability = () => {
        if (resolved || isClosing) return
        
        if (results.length === lastResultCount) {
          stableCount++
          if (stableCount >= 2) {
            // Tidak ada perubahan selama 2 checks (6 detik), anggap selesai
            console.log(`[C300-GPON-SNMP] SNMP walk stable (no new results for 6s), completing with ${results.length} results`)
            finish()
            return
          }
        } else {
          stableCount = 0
          lastResultCount = results.length
        }
        
        if (!resolved && !isClosing) {
          stableCheckTimeout = setTimeout(checkStability, 3000)
        }
      }

      const processCallback = (error: any, varbinds: any[]) => {
        if (resolved || isClosing) return

        // Handle kasus dimana error sebenarnya adalah array varbinds (bug dari net-snmp)
        if (error && Array.isArray(error) && error.length > 0 && error[0]?.oid) {
          // Error sebenarnya adalah varbinds, proses sebagai varbinds
          // Ini adalah bug dari net-snmp library, bukan error yang sebenarnya
          // Jangan log setiap kali karena akan spam console, cukup track count
          varbindsAsErrorCount++
          varbinds = error
          error = null
        }

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
            // Ini adalah bug internal dari net-snmp, ignore dan lanjutkan dengan results yang ada
            console.log(`[C300-GPON-SNMP] Ignoring net-snmp internal bug (req.doneCb), current results: ${results.length}`)
            if (results.length > 0) {
              checkStability()
            }
            return
          }
          
          console.warn(`[C300-GPON-SNMP] SNMP walk callback error: ${errorMsg}, current results: ${results.length}`)
          
          // Jika error tapi sudah ada results, jangan langsung finish
          if (results.length > 0) {
            console.log(`[C300-GPON-SNMP] SNMP walk error but have ${results.length} results, waiting 5 seconds for more data...`)
            if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
            stableCheckTimeout = setTimeout(() => {
              if (!resolved && !isClosing) {
                console.log(`[C300-GPON-SNMP] SNMP walk completed with ${results.length} results (error occurred but results available after 5s wait)`)
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
          checkStability()
          return
        }

        for (const varbind of varbinds) {
          if (snmp.isVarbindError(varbind)) {
            if (varbind.type === snmp.ObjectType.EndOfMibView) {
              console.log(`[C300-GPON-SNMP] EndOfMibView reached, total results: ${results.length}`)
              finish()
              return
            }
            continue
          }

          if (varbind.value !== null && varbind.value !== undefined) {
            results.push({
              oid: varbind.oid.toString(),
              value: varbind.value,
              type: varbind.type,
            })
          }
        }

        // Check stability setelah menerima data
        checkStability()
      }

      const oidString = oid.startsWith('.') ? oid.substring(1) : oid
      
      // Wrap callback untuk menangani error dengan lebih baik
      const wrappedCallback = (error: any, varbinds: any[]) => {
        try {
          processCallback(error, varbinds)
        } catch (callbackError: any) {
          console.error(`[C300-GPON-SNMP] Error in processCallback:`, callbackError?.message || String(callbackError))
          // Jangan reject promise jika sudah ada results
          if (results.length > 0) {
            console.log(`[C300-GPON-SNMP] Callback error but have ${results.length} results, continuing...`)
            checkStability()
          }
        }
      }
      
      try {
        session.subtree(oidString, wrappedCallback)
      } catch (subtreeError: any) {
        console.error(`[C300-GPON-SNMP] Error calling session.subtree:`, subtreeError?.message || String(subtreeError))
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


// Helper function untuk SNMP walk dengan pendekatan sederhana (menggunakan index terakhir sebagai key)
// Menggunakan session.subtree() yang lebih robust daripada session.walk()
async function snmpWalkSimple(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 120000
): Promise<Record<string, string>> {
  // Gunakan snmpWalk yang robust, lalu convert ke Record<string, string>
  const walkResults = await snmpWalk(ipAddress, port, community, version, oid, timeout)
  const results: Record<string, string> = {}
  
  // Hitung base OID length dari OID yang diberikan (termasuk field)
  // Contoh: "1.3.6.1.4.1.3902.1012.3.28.1.1.2" -> base + field length = 13
  // Contoh: "1.3.6.1.4.1.3902.1012.3.50.11.2.1.9" -> base + field length = 14
  const inputOidParts = oid.split('.').filter(p => p.length > 0)
  const baseOidWithFieldLength = inputOidParts.length // Panjang base OID + field
  
  for (const result of walkResults) {
    if (result.value !== null && result.value !== undefined) {
      // Gunakan full index dari OID sebagai key (format: {composite_index}.{onu_id})
      // Contoh: OID .1.3.6.1.4.1.3902.1012.3.28.1.1.2.268632320.3
      // Index yang diambil: 268632320.3 (semua setelah base + field)
      const resultOidStr = result.oid.toString()
      const resultOidParts = resultOidStr.split('.').filter(p => p.length > 0)
      
      // Konversi value ke string
      // Untuk Buffer (OctetString), konversi ke hex string dengan spasi
      let valueStr: string
      if (Buffer.isBuffer(result.value)) {
        // Konversi Buffer ke hex string dengan format: "48 57 54 43 09 C8 53 9E"
        valueStr = Array.from(result.value)
          .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
          .join(' ')
      } else {
        valueStr = result.value.toString()
      }
      
      // Ambil semua bagian setelah base OID + field sebagai index
      if (resultOidParts.length > baseOidWithFieldLength) {
        // Ambil semua bagian setelah base OID + field sebagai index
        let index = resultOidParts.slice(baseOidWithFieldLength).join('.')
        
        // Khusus untuk OID yang memiliki format index dengan .1 di akhir
        // Format index: {composite_index}.{onu_id}.1
        // Kita perlu menghapus .1 di akhir untuk matching dengan index lain
        // Contoh: 268632320.3.1 -> 268632320.3
        // OID yang perlu di-handle:
        // - RX ONU: 1.3.6.1.4.1.3902.1012.3.50.12.1.1.10
        // - PPPoE: 1.3.6.1.4.1.3902.1082.500.20.2.17.2.1.11
        if (index.endsWith('.1') && (
          oid === "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10" || 
          oid === "1.3.6.1.4.1.3902.1082.500.20.2.17.2.1.11"
        )) {
          index = index.slice(0, -2) // Hapus '.1' di akhir
        }
        
        results[index] = valueStr
      } else {
        // Fallback: ambil 2 bagian terakhir sebagai index
        const index = resultOidParts.slice(-2).join('.')
        results[index] = valueStr
      }
    }
  }
  
  return results
}

// C300 GPON Parser dengan OID yang disarankan (metode sederhana)
export async function getC300GponOnuDataViaSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltId: string
): Promise<Array<{
  oltId: string
  name: string
  description: string | null
  pppoe: string | null
  gponOnu: string
  status: string
  rxOlt: string | null
  rxOnu: string | null
  serialNumber: string | null
  actualType: string | null
}>> {
  console.log(`[C300-GPON-SNMP] Fetching ONU data from OLT (${ipAddress}) via SNMP...`)
  console.log(`[C300-GPON-SNMP] Using recommended OIDs (simpler approach)`)

  // OID berdasarkan data terminal yang berhasil
  // Base OID: 1.3.6.1.4.1.3902.1012.3.28.1.1.* (zxGponOntDevMgmtTable)
  // Format index: {composite_index}.{onu_id} (contoh: 268632320.3)
  const baseOid = "1.3.6.1.4.1.3902.1012.3.28.1.1"
  
  // OID untuk name (dari terminal: .2 berhasil - format: "258167670394-burhan" atau langsung name)
  const oidName = `${baseOid}.2`
  
  // OID lain dari base yang sama
  // .1 = zxGponOntDevMgmtTypeName
  // .2 = zxGponOntDevMgmtTypeId (NAME - ini yang benar dari terminal)
  // .3 = zxGponOntDevMgmtName
  // .4 = zxGponOntDevMgmtDesc (DESCRIPTION)
  // .5 = zxGponOntDevMgmtSerialNumber (SERIAL)
  // .6 = zxGponOntDevMgmtStatus (STATUS)
  // .7 = zxGponOntDevMgmtRxOlt (RX OLT)
  // .8 = zxGponOntDevMgmtRxOnu (RX ONU)
  // .9 = zxGponOntDevMgmtTxOlt (TX OLT)
  // .10 = zxGponOntDevMgmtTxOnu (TX ONU)
  // .12 = zxGponOntDevMgmtRegisterTime (REGISTER TIME)
  
  const oidStatus = `${baseOid}.6`  // Status (metode lama, fallback)
  
  // OID untuk Status (dari base OID berbeda - ini yang benar)
  // Base OID: 1.3.6.1.4.1.3902.1012.3.28.2.1.4
  // Format index: {composite_index}.{onu_id} (contoh: 268632320.3)
  // Contoh terminal: .1.3.6.1.4.1.3902.1012.3.28.2.1.4.268632320.3 = INTEGER: 3
  // Interpretasi:
  // - INTEGER: 1 = LOS (Loss of Signal, tidak ada sinyal optik yang diterima)
  // - INTEGER: 3 = Online / WORKING (Aktif dan berkomunikasi dengan OLT)
  // - INTEGER: 4 = Dying Gasp (ONU mati mendadak, misalnya karena listrik padam)
  // - INTEGER: 6 = OffLine (Tidak ada komunikasi)
  const oidStatusNew = "1.3.6.1.4.1.3902.1012.3.28.2.1.4"  // Status (metode baru - ini yang benar)
  const oidRx     = `${baseOid}.7`  // RX OLT (metode lama, bisa digunakan sebagai fallback)
  const oidTx     = `${baseOid}.9`  // TX OLT
  const oidSN     = `${baseOid}.5`  // Serial Number
  const oidReg    = `${baseOid}.12` // Register Time
  
  // OID untuk Description (dari base OID berbeda - ini yang benar)
  // Base OID: 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.*
  const descBaseOid = "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1"
  const oidDesc = `${descBaseOid}.3`  // Description (format: "3$$258167670394-burhan$$" - tampilkan apa adanya)
  
  // OID untuk PPPoE (dari base OID berbeda)
  // Base OID: 1.3.6.1.4.1.3902.1082.500.20.2.17.2.1.11
  // Format index: {composite_index}.{onu_id}.1 (contoh: 285278977.3.1)
  // Value: STRING (contoh: "258167670394")
  const oidPppoe = "1.3.6.1.4.1.3902.1082.500.20.2.17.2.1.11"  // PPPoE (format STRING, tampilkan apa adanya)
  
  // OID untuk RX OLT (dari base OID berbeda)
  // Base OID: 1.3.6.1.4.1.3902.1015.1010.11.2.1.* (metode saat ini)
  const rxBaseOid = "1.3.6.1.4.1.3902.1015.1010.11.2.1"
  const oidRxOltNew = `${rxBaseOid}.2`  // RX OLT (nilai dalam format 0.001 dBm, contoh: -27123 = -27.123 dBm)
  
  // OID untuk RX ONU (dari base OID berbeda - ini yang benar)
  // Base OID: 1.3.6.1.4.1.3902.1012.3.50.12.1.1.10
  // Format index: {composite_index}.{onu_id}.1 (contoh: 268632320.3.1)
  // Rumus konversi: dBm = -30 + (nilai_integer * 0.002)
  // Contoh: 731 -> -30 + (731 * 0.002) = -28.538 dBm
  const oidRxOnuNew = "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10"  // RX ONU (format integer, konversi dengan rumus)
  
  // OID alternatif untuk RX/TX (dari teman user - untuk traffic counter)
  // Base OID: 1.3.6.1.4.1.3902.1015.1010.5.*
  // Catatan: OID ini mengembalikan Counter64 (traffic counter), bukan power level
  // OID ini mungkin untuk traffic statistics, bukan untuk RX power level
  // const trafficBaseOid = "1.3.6.1.4.1.3902.1015.1010.5"
  // const oidOnuRxTraffic = `${trafficBaseOid}.5.1.2`  // ONU RX traffic counter
  // const oidOnuTxTraffic = `${trafficBaseOid}.5.1.17` // ONU TX traffic counter
  // const oidOltRxTraffic = `${trafficBaseOid}.4.1.2`   // OLT RX traffic counter
  // const oidOltTxTraffic = `${trafficBaseOid}.4.1.17`  // OLT TX traffic counter
  
  // OID untuk Actual Type (dari base OID berbeda)
  // Base OID: 1.3.6.1.4.1.3902.1012.3.50.11.2.1.*
  const typeBaseOid = "1.3.6.1.4.1.3902.1012.3.50.11.2.1"
  const oidActualType = `${typeBaseOid}.9`  // Actual Type (contoh: "F670LV9.0", "F660V9", "HG8245H5")

  try {
    // Ambil semua data menggunakan walk sederhana
    console.log(`[C300-GPON-SNMP] Walking OIDs...`)
    const [status, statusNew, rx, tx, name, desc, sn, reg, rxOltNew, rxOnuNew, actualType, pppoe]: [
      Record<string, string>,
      Record<string, string>,
      Record<string, string>,
      Record<string, string>,
      Record<string, string>,
      Record<string, string>,
      Record<string, string>,
      Record<string, string>,
      Record<string, string>,
      Record<string, string>,
      Record<string, string>,
      Record<string, string>
    ] = await Promise.all([
      snmpWalkSimple(ipAddress, port, community, version, oidStatus, 120000).catch((e): Record<string, string> => {
        console.warn(`[C300-GPON-SNMP] SNMP Walk failed for status (old): ${e.message || e}`)
        return {}
      }),
      snmpWalkSimple(ipAddress, port, community, version, oidStatusNew, 120000).catch((e): Record<string, string> => {
        console.warn(`[C300-GPON-SNMP] SNMP Walk failed for status (new): ${e.message || e}`)
        return {}
      }),
      snmpWalkSimple(ipAddress, port, community, version, oidRx, 120000).catch((e): Record<string, string> => {
        console.warn(`[C300-GPON-SNMP] SNMP Walk failed for RX (old): ${e.message || e}`)
        return {}
      }),
      snmpWalkSimple(ipAddress, port, community, version, oidTx, 120000).catch((e): Record<string, string> => {
        console.warn(`[C300-GPON-SNMP] SNMP Walk failed for TX: ${e.message || e}`)
        return {}
      }),
      snmpWalkSimple(ipAddress, port, community, version, oidName, 120000).catch((e): Record<string, string> => {
        console.warn(`[C300-GPON-SNMP] SNMP Walk failed for name: ${e.message || e}`)
        return {}
      }),
      snmpWalkSimple(ipAddress, port, community, version, oidDesc, 120000).catch((e): Record<string, string> => {
        console.warn(`[C300-GPON-SNMP] SNMP Walk failed for description: ${e.message || e}`)
        return {}
      }),
      snmpWalkSimple(ipAddress, port, community, version, oidSN, 120000).catch((e): Record<string, string> => {
        console.warn(`[C300-GPON-SNMP] SNMP Walk failed for serial: ${e.message || e}`)
        return {}
      }),
      snmpWalkSimple(ipAddress, port, community, version, oidReg, 120000).catch((e): Record<string, string> => {
        console.warn(`[C300-GPON-SNMP] SNMP Walk failed for register: ${e.message || e}`)
        return {}
      }),
      snmpWalkSimple(ipAddress, port, community, version, oidRxOltNew, 120000).catch((e): Record<string, string> => {
        console.warn(`[C300-GPON-SNMP] SNMP Walk failed for RX OLT (new): ${e.message || e}`)
        return {}
      }),
      snmpWalkSimple(ipAddress, port, community, version, oidRxOnuNew, 120000).catch((e): Record<string, string> => {
        console.warn(`[C300-GPON-SNMP] SNMP Walk failed for RX ONU (new): ${e.message || e}`)
        return {}
      }),
      snmpWalkSimple(ipAddress, port, community, version, oidActualType, 120000).catch((e): Record<string, string> => {
        console.warn(`[C300-GPON-SNMP] SNMP Walk failed for Actual Type: ${e.message || e}`)
        return {}
      }),
      snmpWalkSimple(ipAddress, port, community, version, oidPppoe, 120000).catch((e): Record<string, string> => {
        console.warn(`[C300-GPON-SNMP] SNMP Walk failed for PPPoE: ${e.message || e}`)
        return {}
      }),
    ])

    console.log(`[C300-GPON-SNMP] Results: Status_OLD=${Object.keys(status).length}, Status_NEW=${Object.keys(statusNew).length}, RX_OLD=${Object.keys(rx).length}, RX_OLT_NEW=${Object.keys(rxOltNew).length}, RX_ONU_NEW=${Object.keys(rxOnuNew).length}, TX=${Object.keys(tx).length}, Name=${Object.keys(name).length}, Desc=${Object.keys(desc).length}, SN=${Object.keys(sn).length}, Reg=${Object.keys(reg).length}, Type=${Object.keys(actualType).length}, PPPoE=${Object.keys(pppoe).length}`)
    
    // Debug: cek beberapa sample data untuk description
    if (Object.keys(desc).length > 0) {
      const sampleIndexes = Object.keys(desc).slice(0, 3)
      console.log(`[C300-GPON-SNMP] Sample Description data:`)
      for (const idx of sampleIndexes) {
        const descVal = desc[idx]
        console.log(`[C300-GPON-SNMP]   Index ${idx}: Desc="${descVal}"`)
      }
    } else {
      console.log(`[C300-GPON-SNMP] Warning: No description data found from OID ${oidDesc}`)
    }
    
    // Debug: cek beberapa sample data untuk PPPoE
    if (Object.keys(pppoe).length > 0) {
      const sampleIndexes = Object.keys(pppoe).slice(0, 3)
      console.log(`[C300-GPON-SNMP] Sample PPPoE data:`)
      for (const idx of sampleIndexes) {
        const pppoeVal = pppoe[idx]
        console.log(`[C300-GPON-SNMP]   Index ${idx}: PPPoE="${pppoeVal}"`)
      }
    } else {
      console.log(`[C300-GPON-SNMP] Warning: No PPPoE data found from OID ${oidPppoe}`)
    }
    
    // Debug: cek beberapa sample data untuk Status baru
    if (Object.keys(statusNew).length > 0) {
      const sampleIndexes = Object.keys(statusNew).slice(0, 5)
      console.log(`[C300-GPON-SNMP] Sample Status NEW data:`)
      for (const idx of sampleIndexes) {
        const statusVal = statusNew[idx]
        console.log(`[C300-GPON-SNMP]   Index ${idx}: Status="${statusVal}"`)
      }
    } else {
      console.log(`[C300-GPON-SNMP] Warning: No Status NEW data found from OID ${oidStatusNew}`)
    }
    
    // Debug: cek beberapa sample data untuk Status lama
    if (Object.keys(status).length > 0) {
      const sampleIndexes = Object.keys(status).slice(0, 5)
      console.log(`[C300-GPON-SNMP] Sample Status OLD data:`)
      for (const idx of sampleIndexes) {
        const statusVal = status[idx]
        console.log(`[C300-GPON-SNMP]   Index ${idx}: Status="${statusVal}"`)
      }
    }
    
    // Debug: cek beberapa sample data RX OLT vs RX ONU untuk memastikan berbeda
    if (Object.keys(rxOltNew).length > 0 && Object.keys(rxOnuNew).length > 0) {
      const sampleIndexes = Object.keys(rxOltNew).slice(0, 3)
      console.log(`[C300-GPON-SNMP] Sample RX OLT vs RX ONU comparison:`)
      for (const idx of sampleIndexes) {
        const rxOltVal = rxOltNew[idx]
        const rxOnuVal = rxOnuNew[idx]
        console.log(`[C300-GPON-SNMP]   Index ${idx}: RX_OLT=${rxOltVal}, RX_ONU=${rxOnuVal}, Same=${rxOltVal === rxOnuVal}`)
      }
    }

    // Helper untuk validasi name
    const isValidName = (str: string | undefined): boolean => {
      if (!str) return false
      const trimmed = str.trim()
      if (trimmed.length === 0) return false
      // Deteksi timestamp
      const timestampPattern = /^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2})?$/
      if (timestampPattern.test(trimmed)) return false
      if (trimmed.length < 3) return false
      return true
    }

    // Helper untuk deteksi timestamp
    const isTimestamp = (str: string): boolean => {
      if (!str) return false
      const trimmed = str.trim()
      const timestampPattern = /^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2})?$/
      return timestampPattern.test(trimmed)
    }

    // Helper untuk konversi hex string (spasi-separated) ke ASCII string
    // Format: "32 35 38 31 36 37" -> "258167"
    const convertHexStringToAscii = (hexString: string): string | null => {
      if (!hexString) return null
      
      try {
        // Split by space dan filter empty
        const hexBytes = hexString.trim().split(/\s+/).filter(b => b.length > 0)
        
        if (hexBytes.length === 0) return null
        
        // Konversi setiap hex byte ke ASCII character
        let asciiStr = ''
        for (const hexByte of hexBytes) {
          const decimal = parseInt(hexByte, 16)
          if (!isNaN(decimal) && decimal >= 0 && decimal <= 255) {
            asciiStr += String.fromCharCode(decimal)
          } else {
            // Jika ada byte yang tidak valid, return null
            return null
          }
        }
        
        return asciiStr
      } catch (error) {
        console.warn(`[C300-GPON-SNMP] Error converting hex string to ASCII: ${error}`)
        return null
      }
    }

    // Helper untuk konversi Hex-STRING ke Serial Number
    // Format: "48 57 54 43 09 C8 53 9E" -> "HWTC09C8539E"
    // 4 byte pertama: konversi ke ASCII
    // 4 byte terakhir: konversi ke hex string (tanpa spasi)
    const convertHexToSerialNumber = (hexString: string): string | null => {
      if (!hexString) return null
      
      // Bersihkan string dari "Hex-STRING:" atau format lain
      let cleanHex = hexString.trim()
      if (cleanHex.toLowerCase().includes('hex-string:')) {
        cleanHex = cleanHex.split(':').slice(1).join(':').trim()
      }
      
      // Split by space dan filter empty
      const hexBytes = cleanHex.split(/\s+/).filter(b => b.length > 0)
      
      if (hexBytes.length < 8) {
        // Jika tidak 8 byte, return null atau original value
        return null
      }
      
      try {
        // Ambil 4 byte pertama (indeks 0-3)
        const first4Bytes = hexBytes.slice(0, 4)
        // Konversi ke ASCII
        let asciiPart = ''
        for (const hexByte of first4Bytes) {
          const decimal = parseInt(hexByte, 16)
          if (decimal >= 32 && decimal <= 126) { // Printable ASCII
            asciiPart += String.fromCharCode(decimal)
          } else {
            // Jika ada byte yang tidak valid, return null
            return null
          }
        }
        
        // Ambil 4 byte terakhir (indeks 4-7)
        const last4Bytes = hexBytes.slice(4, 8)
        // Konversi ke hex string tanpa spasi (uppercase)
        const hexPart = last4Bytes.map(b => b.toUpperCase()).join('')
        
        // Gabungkan
        return asciiPart + hexPart
      } catch (error) {
        console.warn(`[C300-GPON-SNMP] Error converting hex to serial: ${error}`)
        return null
      }
    }

    // Gabungkan berdasarkan INDEX
    const onus: Array<{
      oltId: string
      name: string
      description: string | null
      pppoe: string | null
      gponOnu: string
      status: string
      rxOlt: string | null
      rxOnu: string | null
      serialNumber: string | null
      actualType: string | null
    }> = []

    // Ambil semua index dari status baru, status lama, atau name (prioritas: status baru > status lama > name)
    const statusNewIndexes = Object.keys(statusNew)
    const statusIndexes = Object.keys(status)
    const nameIndexes = Object.keys(name)
    // Prioritas: status baru > status lama > name
    const indexes = statusNewIndexes.length > 0 ? statusNewIndexes : (statusIndexes.length > 0 ? statusIndexes : nameIndexes)
    
    if (indexes.length === 0) {
      console.log(`[C300-GPON-SNMP] No ONU found (no status or name data)`)
      return []
    }
    
    console.log(`[C300-GPON-SNMP] Processing ${indexes.length} ONUs...`)

    for (const idx of indexes) {
      // Prioritas: status baru, fallback: status lama
      const statusValueNew = statusNew[idx] || ""
      const statusValue = status[idx] || ""
      const rxValue = rx[idx] || ""  // RX OLT (metode lama, fallback)
      const rxOltNewValue = rxOltNew[idx] || ""  // RX OLT (metode baru)
      const rxOnuNewValue = rxOnuNew[idx] || ""  // RX ONU (metode baru)
      const txValue = tx[idx] || ""
      const nameValue = name[idx] || ""
      const descValue = desc[idx] || ""
      const snValue = sn[idx] || ""
      const regValue = reg[idx] || ""
      const actualTypeValue = actualType[idx] || ""
      // Handle PPPoE: cari berdasarkan index atau onu_id (karena index mungkin berbeda)
      let pppoeValue = pppoe[idx] || ""
      
      // Jika tidak ada di index yang sama, coba cari berdasarkan onu_id saja
      if (!pppoeValue) {
        const indexParts = idx.split('.')
        if (indexParts.length >= 2) {
          const onuId = indexParts[1]
          // Cari di semua key PPPoE yang berakhir dengan onu_id yang sama
          const matchingKeys = Object.keys(pppoe).filter(k => k.endsWith(`.${onuId}`) || k === onuId)
          if (matchingKeys.length > 0) {
            // Ambil yang pertama (atau yang paling cocok)
            pppoeValue = pppoe[matchingKeys[0]] || ""
          }
        }
      }
      
      // Konversi dari hex string ke ASCII jika perlu
      let finalPppoe: string | null = null
      if (pppoeValue) {
        pppoeValue = pppoeValue.trim()
        
        // Cek jika format hex string (spasi-separated hex bytes)
        if (/^[0-9A-Fa-f]{1,2}(\s+[0-9A-Fa-f]{1,2})+$/.test(pppoeValue)) {
          const converted = convertHexStringToAscii(pppoeValue)
          if (converted) {
            finalPppoe = converted
          }
        } else {
          // Jika bukan hex string, gunakan langsung
          finalPppoe = pppoeValue
        }
        
        if (finalPppoe && finalPppoe.length === 0) {
          finalPppoe = null
        }
      }

      // Map status value (prioritas: metode baru, fallback: metode lama)
      let statusStr = 'Unknown'
      
      // Coba metode baru dulu
      if (statusValueNew) {
        const statusNum = parseInt(statusValueNew, 10)
        if (!isNaN(statusNum)) {
          // Interpretasi sesuai OID baru (1.3.6.1.4.1.3902.1012.3.28.2.1.4):
          // INTEGER: 1 = LOS (Loss of Signal, tidak ada sinyal optik yang diterima)
          // INTEGER: 3 = Online / WORKING (Aktif dan berkomunikasi dengan OLT)
          // INTEGER: 4 = Dying Gasp (ONU mati mendadak, misalnya karena listrik padam)
          // INTEGER: 6 = OffLine (Tidak ada komunikasi)
          if (statusNum === 1) statusStr = 'LOS'
          else if (statusNum === 3) statusStr = 'Online'
          else if (statusNum === 4) statusStr = 'DyingGasp'
          else if (statusNum === 6) statusStr = 'OffLine'
          else {
            statusStr = 'Unknown'
            console.log(`[C300-GPON-SNMP] Warning: Unknown status value ${statusNum} from NEW OID for index ${idx}`)
          }
        }
      }
      
      // Fallback: jika metode baru tidak ada, gunakan metode lama
      if (statusStr === 'Unknown' && statusValue) {
        const statusNum = parseInt(statusValue, 10)
        if (!isNaN(statusNum)) {
          // Interpretasi sesuai OID lama:
          // 1 = LOS, 3 = Online, 4 = DyingGasp, 6 = OffLine
          if (statusNum === 1) statusStr = 'LOS'
          else if (statusNum === 3) statusStr = 'Online'
          else if (statusNum === 4) statusStr = 'DyingGasp'
          else if (statusNum === 6) statusStr = 'OffLine'
          else {
            statusStr = 'Unknown'
            console.log(`[C300-GPON-SNMP] Warning: Unknown status value ${statusNum} from OLD OID for index ${idx}`)
          }
        }
      }
      
      // Jika masih Unknown, coba infer dari name
      if (statusStr === 'Unknown') {
        // Jika name ada dan valid, anggap Online
        if (nameValue && isValidName(nameValue)) {
          statusStr = 'Online'
        }
      }

      // Parse RX OLT value (prioritas: metode baru, fallback: metode lama)
      // Format baru: nilai integer negatif dalam format 0.001 dBm
      // Contoh: -27123 = -27.123 dBm, -80000 = -80.000 dBm (nilai khusus untuk LOS/tidak terdeteksi)
      let rxOltStr: string | null = null
      
      // Coba metode baru dulu
      if (rxOltNewValue) {
        const rxOltNum = parseInt(rxOltNewValue, 10)
        if (!isNaN(rxOltNum)) {
          // Nilai -80000 atau lebih negatif biasanya berarti LOS/tidak terdeteksi
          if (rxOltNum <= -80000) {
            rxOltStr = "N/A"
          } else {
            // Konversi dari format 0.001 dBm ke dBm
            rxOltStr = `${(rxOltNum / 1000).toFixed(3)} dBm`
          }
        }
      }
      
      // Fallback: jika metode baru tidak ada, gunakan metode lama
      if (!rxOltStr && rxValue) {
        const rxNum = parseFloat(rxValue)
        if (!isNaN(rxNum)) {
          // Jika nilai besar (misalnya > 1000), kemungkinan dalam format 0.01 dBm
          if (Math.abs(rxNum) > 1000) {
            rxOltStr = `${(rxNum / 100).toFixed(2)} dBm`
          } else {
            rxOltStr = `${rxNum.toFixed(2)} dBm`
          }
        }
      }
      
      // Jika masih null setelah semua fallback, set ke "N/A"
      if (!rxOltStr) {
        rxOltStr = "N/A"
      }
      
      // Jika status masih Unknown atau LOS, coba infer dari RX OLT (jika ada RX OLT yang valid, kemungkinan Online)
      if ((statusStr === 'Unknown' || statusStr === 'LOS') && rxOltStr && rxOltStr !== 'N/A') {
        const rxOltNum = parseFloat(rxOltStr.replace(/[^\d.-]/g, ''))
        if (!isNaN(rxOltNum) && rxOltNum > -30) {
          // RX OLT yang baik (lebih dari -30 dBm) biasanya berarti Online
          statusStr = 'Online'
        }
      }

      // Parse RX ONU value (OID baru: 1.3.6.1.4.1.3902.1012.3.50.12.1.1.10)
      // Format: integer value (contoh: 731)
      // Rumus konversi: dBm = -30 + (nilai_integer * 0.002)
      // Contoh: 731 -> -30 + (731 * 0.002) = -30 + 1.462 = -28.538 dBm
      let rxOnuStr: string | null = null
      
      // Gunakan OID baru dengan rumus konversi
      if (rxOnuNewValue) {
        const rxOnuNum = parseInt(rxOnuNewValue, 10)
        if (!isNaN(rxOnuNum)) {
          if (rxOnuNum === 0 || rxOnuNum === 65535) {
            // Nilai 0 atau 65535 biasanya berarti tidak terdeteksi atau invalid
            rxOnuStr = "N/A"
          } else {
            // Konversi menggunakan rumus: dBm = -30 + (nilai * 0.002)
            const dbmValue = -30 + (rxOnuNum * 0.002)
            rxOnuStr = `${dbmValue.toFixed(3)} dBm`
          }
        }
      }
      
      // Fallback: jika metode baru tidak ada, gunakan TX dari OLT (metode lama)
      if (!rxOnuStr && txValue) {
        const txNum = parseFloat(txValue)
        if (!isNaN(txNum)) {
          if (Math.abs(txNum) > 1000) {
            rxOnuStr = `${(txNum / 100).toFixed(2)} dBm`
          } else {
            rxOnuStr = `${txNum.toFixed(2)} dBm`
          }
        }
      }
      
      // Jika masih null setelah semua fallback, set ke "N/A"
      if (!rxOnuStr) {
        rxOnuStr = "N/A"
      }

      // Handle name: konversi dari hex string ke ASCII jika perlu
      // Format dari terminal OID .2 bisa berupa:
      // - Hex string: "32 35 38 31 36 37 36 37 30 33 39 34 2D 62 75 72 68 61 6E" → "258167670394-burhan"
      // - String langsung: "258167670394-burhan" → "258167670394-burhan"
      let finalName = nameValue
      
      if (finalName) {
        finalName = finalName.trim()
        
        // Cek jika format hex string (spasi-separated hex bytes)
        if (/^[0-9A-Fa-f]{1,2}(\s+[0-9A-Fa-f]{1,2})+$/.test(finalName)) {
          const converted = convertHexStringToAscii(finalName)
          if (converted) {
            finalName = converted
          }
        }
        // Jika bukan hex string, gunakan langsung
      }
      
      // Jika name kosong atau tidak valid, gunakan fallback
      if (!finalName || !isValidName(finalName)) {
        // Parse index untuk mendapatkan ONU ID sebagai fallback
        const indexParts = idx.split('.')
        const onuId = indexParts.length >= 2 ? indexParts[1] : idx
        finalName = `ONU-${onuId}`
      }

      // Handle description: tampilkan apa adanya tanpa modifikasi
      // Format dari OID baru: "3$$258167670394-burhan$$" atau format lain
      // Tampilkan langsung tanpa extract atau modifikasi
      // Catatan: OID baru menggunakan index berbeda (285278977.3 vs 268632320.3)
      // Perlu mencocokkan berdasarkan composite index atau onu_id
      let finalDesc = descValue || null
      
      // Jika tidak ada di index yang sama, coba cari berdasarkan onu_id saja
      if (!finalDesc) {
        const indexParts = idx.split('.')
        if (indexParts.length >= 2) {
          const onuId = indexParts[1]
          // Cari di semua key description yang berakhir dengan onu_id yang sama
          const matchingKeys = Object.keys(desc).filter(k => k.endsWith(`.${onuId}`) || k === onuId)
          if (matchingKeys.length > 0) {
            // Ambil yang pertama (atau yang paling cocok)
            finalDesc = desc[matchingKeys[0]] || null
          }
        }
      }
      
      if (finalDesc) {
        finalDesc = finalDesc.trim()
        // Konversi dari hex string ke ASCII jika perlu
        if (/^[0-9A-Fa-f]{1,2}(\s+[0-9A-Fa-f]{1,2})+$/.test(finalDesc)) {
          const converted = convertHexStringToAscii(finalDesc)
          if (converted) {
            finalDesc = converted
          }
        }
        if (finalDesc.length === 0) {
          finalDesc = null
        }
      }
      
      if (!finalDesc) {
        finalDesc = `Index: ${idx}`
      }

      // Handle serial number: konversi dari Hex-STRING ke format yang benar
      let finalSerial = snValue || null
      if (finalSerial) {
        // Cek jika format Hex-STRING (dari OID .5)
        if (finalSerial.includes('Hex-STRING:') || /^[0-9A-Fa-f\s]+$/.test(finalSerial.trim())) {
          const converted = convertHexToSerialNumber(finalSerial)
          if (converted) {
            finalSerial = converted
          } else {
            // Jika konversi gagal, coba gunakan value langsung atau set null
            finalSerial = null
          }
        } else if (isTimestamp(finalSerial)) {
          // Jangan simpan jika timestamp
          finalSerial = null
        }
        // Jika format lain (string biasa), gunakan langsung
      }

      // Parse index untuk mendapatkan gponOnu
      // Format index: {composite_index}.{onu_id} (contoh: 268632320.3)
      // Composite index perlu di-parse untuk mendapatkan frame/slot/port
      const indexParts = idx.split('.')
      let gponOnu = `idx-${idx}` // Default fallback
      
      if (indexParts.length >= 2) {
        const compositeIndex = parseInt(indexParts[0], 10)
        const onuId = indexParts[1]
        
        // Parse composite index (Type 1 format)
        // Format: Type (4 bit) | Shelf (4 bit) | Slot (8 bit) | Port (8 bit) | Reserved (8 bit)
        if (!isNaN(compositeIndex)) {
          const type = (compositeIndex >> 28) & 0xF
          const shelf = (compositeIndex >> 24) & 0xF
          const slot = (compositeIndex >> 16) & 0xFF
          const port = (compositeIndex >> 8) & 0xFF
          const frame = shelf === 0 ? 1 : shelf
          
          // Format: frame/slot/port:onuId
          gponOnu = `${frame}/${slot}/${port}:${onuId}`
        } else {
          gponOnu = `idx-${idx}`
        }
      }

      // Handle actual type: konversi dari hex string ke ASCII jika perlu
      let finalActualType = actualTypeValue || null
      if (finalActualType) {
        finalActualType = finalActualType.trim()
        
        // Cek jika format hex string (spasi-separated hex bytes)
        if (/^[0-9A-Fa-f]{1,2}(\s+[0-9A-Fa-f]{1,2})+$/.test(finalActualType)) {
          const converted = convertHexStringToAscii(finalActualType)
          if (converted) {
            finalActualType = converted
          }
        }
        // Jika bukan hex string, gunakan langsung
        
        if (finalActualType && finalActualType.length === 0) {
          finalActualType = null
        }
      }

      onus.push({
        oltId,
        name: finalName,
        description: finalDesc,
        pppoe: finalPppoe,
        gponOnu,
        status: statusStr,
        rxOlt: rxOltStr,
        rxOnu: rxOnuStr,
        serialNumber: finalSerial,
        actualType: finalActualType,
      })
    }

    console.log(`[C300-GPON-SNMP] Successfully parsed ${onus.length} ONUs`)
    console.log(`[C300-GPON-SNMP] Summary:`)
    console.log(`[C300-GPON-SNMP]   - Total ONUs: ${onus.length}`)
    console.log(`[C300-GPON-SNMP]   - With Name: ${onus.filter(o => o.name && !o.name.startsWith('ONU-')).length}`)
    console.log(`[C300-GPON-SNMP]   - With Status: ${onus.filter(o => o.status !== 'Unknown').length}`)
    console.log(`[C300-GPON-SNMP]   - With RX OLT: ${onus.filter(o => o.rxOlt).length}`)
    console.log(`[C300-GPON-SNMP]   - With RX ONU: ${onus.filter(o => o.rxOnu).length}`)
    console.log(`[C300-GPON-SNMP]   - With Serial: ${onus.filter(o => o.serialNumber).length}`)
    console.log(`[C300-GPON-SNMP]   - With Description: ${onus.filter(o => o.description && !o.description.startsWith('Index:')).length}`)
    
    return onus
  } catch (error: any) {
    console.error(`[C300-GPON-SNMP] Error:`, error)
    throw error
  }
}


export async function POST(req: NextRequest) {
  try {
    console.log(`[All-ONU] Starting sync from all OLTs...`)

    const oltRepo = getOLTRepository()
    const onuRepo = getOnuRepository()

    // Check query parameter untuk clear existing data
    const { searchParams } = new URL(req.url)
    const clearExisting = searchParams.get('clear') === 'true'

    // Get all OLTs dengan SNMP connected
    const olts = await oltRepo.findAll()
    const connectedOlts = olts.filter(
      (olt) => olt.snmpConnected && olt.snmpCommunityWrite && olt.type?.toLowerCase().includes('c300')
    )

    if (connectedOlts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Tidak ada OLT C300 yang terhubung via SNMP',
        synced: 0,
        total: 0,
      })
    }

    console.log(`[All-ONU] Found ${connectedOlts.length} C300 OLTs with SNMP connected`)

    // Hapus data lama jika diminta
    if (clearExisting) {
      console.log(`[All-ONU] Clearing existing ONU data...`)
      for (const olt of connectedOlts) {
        await onuRepo.deleteByOltId(olt.id)
        console.log(`[All-ONU] Deleted existing ONUs for OLT ${olt.name}`)
      }
      console.log(`[All-ONU] Existing ONU data cleared`)
    }

    let totalSynced = 0
    const errors: string[] = []

    // Sync ONU dari setiap OLT
    for (const olt of connectedOlts) {
      try {
        console.log(`[All-ONU] Trying C300 GPON parser (standard GPON MIB .1012) for OLT ${olt.name}...`)

        const onuData = await getC300GponOnuDataViaSNMP(
          olt.ipAddress,
          olt.snmpPort,
          olt.snmpCommunityWrite,
          olt.snmpVersion,
          olt.id
        )

        if (onuData.length === 0) {
          console.log(`[All-ONU] No ONU data found for OLT ${olt.name}`)
          continue
        }

        console.log(`[All-ONU] Saving ${onuData.length} ONUs to database for OLT ${olt.name}...`)

        // Upsert setiap ONU
        let savedCount = 0
        for (const onu of onuData) {
          try {
            await onuRepo.upsert(olt.id, onu.gponOnu, {
              oltId: olt.id,
              name: onu.name,
              description: onu.description,
              pppoe: onu.pppoe,
              gponOnu: onu.gponOnu,
              status: onu.status,
              rxOlt: onu.rxOlt,
              rxOnu: onu.rxOnu,
              serialNumber: onu.serialNumber,
              actualType: onu.actualType,
            })
            savedCount++
          } catch (error: any) {
            console.error(`[All-ONU] Error saving ONU ${onu.gponOnu}:`, error.message)
          }
        }

        // Update OLT onuLastSync
        await oltRepo.update(olt.id, {
          onuLastSync: new Date(),
        })

        totalSynced += savedCount
        console.log(`[All-ONU] Successfully saved ${savedCount}/${onuData.length} ONUs for OLT ${olt.name}`)
      } catch (error: any) {
        const errorMsg = `Error syncing OLT ${olt.name}: ${error.message}`
        console.error(`[All-ONU] ${errorMsg}`)
        errors.push(errorMsg)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil sync ${totalSynced} ONU dari ${connectedOlts.length} OLT`,
      synced: totalSynced,
      total: connectedOlts.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('[All-ONU] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Gagal sync ONU dari OLT',
      },
      { status: 500 }
    )
  }
}


