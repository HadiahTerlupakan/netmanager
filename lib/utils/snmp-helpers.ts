/**
 * SNMP Helper Functions
 * Utility functions untuk SNMP operations (Get, Walk, dll)
 */

import snmp from 'net-snmp'

// Global handler untuk suppress error dari net-snmp library bug
if (typeof process !== 'undefined' && !(global as any).__SNMP_ERROR_HANDLER_ADDED) {
  try {
    const originalConsoleError = console.error
    console.error = (...args: any[]) => {
      const errorStr = args.join(' ')
      if (errorStr.includes('req.doneCb is not a function')) {
        return
      }
      originalConsoleError.apply(console, args)
    }
    
    const snmpErrorHandler = (error: Error) => {
      if (error && error.message && error.message.includes('req.doneCb is not a function')) {
        return
      }
      originalConsoleError('[Uncaught Exception]', error)
    }
    
    process.on('uncaughtException', snmpErrorHandler)
    ;(global as any).__SNMP_ERROR_HANDLER_ADDED = true
  } catch (e) {
    console.warn('[SNMP] Failed to setup error handler:', e)
  }
}

/**
 * SNMP Get - untuk single OID
 */
export async function snmpGet(
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
      let snmpVersion: 0 | 1 | undefined = 1
      if (version === '1') {
        snmpVersion = 0
      } else if (version === '3') {
        snmpVersion = 1
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

/**
 * SNMP Walk - robust version dengan stability check
 */
export async function snmpWalk(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 60000,
  maxResults?: number
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
    let varbindsAsErrorCount = 0

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
        if (results.length > 0) {
          if (varbindsAsErrorCount > 0) {
            console.log(`[SNMP-Walk] Completed with ${results.length} results. Note: ${varbindsAsErrorCount} varbinds received as error parameter (net-snmp bug, already handled)`)
          } else {
            console.log(`[SNMP-Walk] Completed with ${results.length} results despite error: ${error.message || error}`)
          }
          resolve(results)
        } else {
          reject(error)
        }
      } else {
        if (varbindsAsErrorCount > 0) {
          console.log(`[SNMP-Walk] Completed with ${results.length} results. Note: ${varbindsAsErrorCount} varbinds received as error parameter (net-snmp bug, already handled)`)
        }
        resolve(results)
      }
    }

    try {
      let snmpVersion: 0 | 1 | undefined = 1
      if (version === '1') {
        snmpVersion = 0
      } else if (version === '3') {
        console.warn(`[SNMP-Walk] SNMP v3 is not supported, using v2c instead`)
        snmpVersion = 1
      }

      session = snmp.createSession(ipAddress, community, {
        port: port,
        version: snmpVersion,
        retries: 3,
        timeout: 10000,
      })

      const adjustedTimeout = timeout > 120000 ? timeout : 300000
      timeoutId = setTimeout(() => {
        if (!resolved) {
          if (results.length > 0) {
            const waitTime = results.length > 500 ? 15000 : 10000
            console.log(`[SNMP-Walk] Timeout reached with ${results.length} results, waiting ${waitTime/1000} seconds for more data...`)
            if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
            stableCheckTimeout = setTimeout(() => {
              if (!resolved && !isClosing) {
                console.log(`[SNMP-Walk] Completed with ${results.length} results (timeout reached)`)
                finish()
              }
            }, waitTime)
          } else {
            finish(new Error('SNMP walk timeout - no results'))
          }
        }
      }, adjustedTimeout)

      // Track history untuk melihat apakah data masih terus masuk
      let resultHistory: number[] = []
      const maxHistorySize = 6 // Track 6 checks terakhir (30 detik)
      
      const checkStability = () => {
        if (resolved || isClosing) return
        
        // Tambahkan current count ke history
        resultHistory.push(results.length)
        if (resultHistory.length > maxHistorySize) {
          resultHistory.shift() // Hapus yang paling lama
        }
        
        if (results.length === lastResultCount) {
          stableCount++
          // Gunakan stability check yang lebih konservatif
          // Untuk memastikan semua data terambil, terutama untuk dataset besar
          // Minimum 20 checks (100 detik) untuk semua dataset untuk memastikan tidak ada data yang terlewat
          let requiredStableChecks = 20 // Minimum 20 checks (100 detik) untuk semua dataset
          let checkInterval = 5000 // 5 detik default
          
          // Untuk dataset yang diharapkan besar (600+), gunakan stability check yang lebih lama
          if (results.length > 600) {
            requiredStableChecks = 30 // 30 checks = 150 detik untuk dataset 600+
          } else if (results.length > 500) {
            requiredStableChecks = 30 // 30 checks = 150 detik (ditingkatkan dari 25)
          } else if (results.length > 300) {
            requiredStableChecks = 25 // 25 checks = 125 detik (ditingkatkan dari 20)
          } else if (results.length > 100) {
            requiredStableChecks = 20 // 20 checks = 100 detik (ditingkatkan dari 15)
          } else if (results.length > 50) {
            requiredStableChecks = 20 // 20 checks = 100 detik (ditingkatkan dari 15)
          } else {
            // Untuk dataset kecil (< 50), gunakan 20 checks untuk memastikan tidak ada data yang terlewat
            // Ini penting karena data mungkin masih terus masuk secara batch
            requiredStableChecks = 20 // 20 checks = 100 detik (ditingkatkan dari 15)
          }
          
          // Cek apakah data masih terus masuk dalam history
          // Jika dalam 6 checks terakhir masih ada peningkatan, lanjutkan lebih lama
          if (resultHistory.length >= 3) {
            const recentGrowth = resultHistory[resultHistory.length - 1] - resultHistory[0]
            if (recentGrowth > 0) {
              // Data masih terus masuk, reset stableCount dan lanjutkan
              console.log(`[SNMP-Walk] Data still growing (${recentGrowth} new results in last ${resultHistory.length * 5}s), continuing...`)
              stableCount = Math.max(0, stableCount - 5) // Kurangi stableCount untuk memberikan lebih banyak waktu
            }
          }
          
          if (stableCount >= requiredStableChecks) {
            const totalWaitTime = requiredStableChecks * (checkInterval / 1000)
            console.log(`[SNMP-Walk] Stable (no new results for ${totalWaitTime}s), completing with ${results.length} results`)
            finish()
            return
          }
        } else {
          // Data masih masuk, reset stableCount
          stableCount = 0
          lastResultCount = results.length
          if (results.length > 0 && (results.length % 50 === 0 || results.length % 100 === 0)) {
            console.log(`[SNMP-Walk] Progress: ${results.length} results collected...`)
          }
        }
        
        if (!resolved && !isClosing) {
          stableCheckTimeout = setTimeout(checkStability, 5000)
        }
      }

      const processCallback = (error: any, varbinds: any[]) => {
        if (resolved || isClosing) return

        if (error && Array.isArray(error) && error.length > 0 && error[0]?.oid) {
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
          
          if (errorMsg.includes('req.doneCb') || errorMsg.includes('doneCb is not a function')) {
            console.log(`[SNMP-Walk] Ignoring net-snmp internal bug (req.doneCb), current results: ${results.length}`)
            if (results.length > 0) {
              checkStability()
            }
            return
          }
          
          console.warn(`[SNMP-Walk] Callback error: ${errorMsg}, current results: ${results.length}`)
          
          if (results.length > 0) {
            console.log(`[SNMP-Walk] Error but have ${results.length} results, waiting 5 seconds for more data...`)
            if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
            stableCheckTimeout = setTimeout(() => {
              if (!resolved && !isClosing) {
                console.log(`[SNMP-Walk] Completed with ${results.length} results (error occurred but results available after 5s wait)`)
                finish()
              }
            }, 5000)
          } else {
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
              console.log(`[SNMP-Walk] EndOfMibView reached, total results: ${results.length}`)
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
            
            if (maxResults && results.length >= maxResults) {
              console.log(`[SNMP-Walk] Reached maxResults (${maxResults}), stopping early...`)
              finish()
              return
            }
          }
        }

        checkStability()
      }

      const wrappedCallback = (error: any, varbinds: any[]) => {
        try {
          processCallback(error, varbinds)
        } catch (callbackError: any) {
          console.error(`[SNMP-Walk] Error in processCallback:`, callbackError?.message || String(callbackError))
          if (results.length > 0) {
            console.log(`[SNMP-Walk] Callback error but have ${results.length} results, continuing...`)
            checkStability()
          }
        }
      }
      
      try {
        const oidString = oid.startsWith('.') ? oid.substring(1) : oid
        session.subtree(oidString, wrappedCallback)
      } catch (subtreeError: any) {
        console.error(`[SNMP-Walk] Error calling session.subtree:`, subtreeError?.message || String(subtreeError))
        finish(subtreeError)
        return
      }
      
      setTimeout(checkStability, 2000)
    } catch (error: any) {
      finish(error)
    }
  })
}

/**
 * SNMP Walk Simple - mengembalikan Record<string, string>
 */
export async function snmpWalkSimple(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 120000,
  maxResults?: number
): Promise<Record<string, string>> {
  const walkResults = await snmpWalk(ipAddress, port, community, version, oid, timeout, maxResults)
  const results: Record<string, string> = {}
  
  const inputOidParts = oid.split('.').filter(p => p.length > 0)
  const baseOidWithFieldLength = inputOidParts.length
  
  for (const result of walkResults) {
    if (result.value !== null && result.value !== undefined) {
      const resultOidStr = result.oid.toString()
      const resultOidParts = resultOidStr.split('.').filter(p => p.length > 0)
      
      let valueStr: string
      if (Buffer.isBuffer(result.value)) {
        valueStr = Array.from(result.value)
          .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
          .join(' ')
      } else {
        valueStr = result.value.toString()
      }
      
      if (resultOidParts.length > baseOidWithFieldLength) {
        let index = resultOidParts.slice(baseOidWithFieldLength).join('.')
        
        if (index.endsWith('.1') && (
          oid === "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10" || 
          oid === "1.3.6.1.4.1.3902.1082.500.20.2.17.2.1.11"
        )) {
          index = index.slice(0, -2)
        }
        
        results[index] = valueStr
      } else {
        const index = resultOidParts.slice(-2).join('.')
        results[index] = valueStr
      }
    }
  }
  
  return results
}

