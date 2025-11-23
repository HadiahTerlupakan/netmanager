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
          // Log error untuk debugging (hanya untuk beberapa OID pertama untuk menghindari spam)
          if (Math.random() < 0.01) { // Log 1% dari error untuk debugging
            console.log(`[SNMP-Get] Error or empty varbinds for OID ${oid}:`, error?.message || 'No varbinds')
          }
          finish(null)
        } else {
          const varbind = varbinds[0]
          if (snmp.isVarbindError(varbind)) {
            // Log error untuk debugging (hanya untuk beberapa OID pertama)
            if (Math.random() < 0.01) { // Log 1% dari error untuk debugging
              const errorMsg = varbind.value?.toString() || 'Unknown error'
              console.log(`[SNMP-Get] Varbind error for OID ${oid}: ${errorMsg}`)
            }
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
 * SNMP Get Multiple - untuk mengambil multiple OIDs sekaligus
 * Digunakan untuk update data spesifik (tidak perlu WALK semua)
 * @param ipAddress - IP address OLT
 * @param port - SNMP port (default: 161)
 * @param community - SNMP community
 * @param version - SNMP version ('1', '2c', '3')
 * @param oids - Array of OIDs yang akan di-fetch
 * @param timeout - Timeout dalam milliseconds (default: 10000)
 * @returns Record dengan OID sebagai key dan value sebagai string
 */
export async function snmpGetMultiple(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oids: string[],
  timeout: number = 10000
): Promise<Record<string, string>> {
  if (!oids || oids.length === 0) {
    return {}
  }

  // Gunakan Promise.all untuk fetch semua OIDs secara paralel
  const results = await Promise.all(
    oids.map(oid => 
      snmpGet(ipAddress, port, community, version, oid, timeout)
        .then(value => ({ oid, value }))
        .catch(() => ({ oid, value: null }))
    )
  )

  // Convert ke Record<string, string>
  const resultMap: Record<string, string> = {}
  for (const { oid, value } of results) {
    if (value !== null) {
      resultMap[oid] = value
    }
  }

  return resultMap
}

/**
 * SNMP Table - untuk mengambil data dalam bentuk tabel (lebih efisien untuk multiple columns)
 * Menggunakan GETBULK untuk mengambil beberapa kolom sekaligus
 * @param ipAddress - IP address OLT
 * @param port - SNMP port (default: 161)
 * @param community - SNMP community
 * @param version - SNMP version ('1', '2c', '3')
 * @param baseOid - Base OID untuk tabel (misalnya: 1.3.6.1.4.1.3902.1012.3.28.2.1)
 * @param columns - Array of column OIDs relatif ke baseOid (misalnya: ['4', '5'] untuk status dan serial)
 * @param timeout - Timeout dalam milliseconds (default: 30000)
 * @returns Record dengan key format: "columnOid.index" dan value sebagai string
 *          Contoh: { "4.268632320.3": "1", "5.268632320.3": "ZTEGCAFF2D4A" }
 */
export async function snmpTable(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  baseOid: string,
  columns: string[],
  timeout: number = 30000
): Promise<Record<string, string>> {
  if (!columns || columns.length === 0) {
    return {}
  }

  return new Promise((resolve) => {
    let resolved = false
    let session: any = null
    let timeoutId: NodeJS.Timeout | null = null

    const finish = (results: Record<string, string>) => {
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
      resolve(results)
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

      // Build full OIDs untuk setiap kolom
      const fullOids = columns.map(col => {
        // Jika column sudah full OID, gunakan langsung
        if (col.includes(baseOid)) {
          return col
        }
        // Jika column adalah relative OID, gabungkan dengan baseOid
        const baseOidClean = baseOid.endsWith('.') ? baseOid.slice(0, -1) : baseOid
        return `${baseOidClean}.${col}`
      })

      console.log(`[SNMP-Table] Fetching table with baseOid: ${baseOid}, columns: ${columns.length}`)
      console.log(`[SNMP-Table] Full OIDs:`, fullOids)

      // Gunakan GETBULK untuk setiap kolom secara paralel (lebih efisien daripada multiple GET)
      // Ini adalah implementasi SNMP TABLE menggunakan GETBULK
      Promise.all(
        fullOids.map(oid => 
          snmpGetBulkSimple(ipAddress, port, community, version, oid, timeout)
            .catch((error) => {
              console.warn(`[SNMP-Table] GETBULK failed for OID ${oid}:`, error.message || error)
              return {}
            })
        )
      ).then(resultsArray => {
        // Gabungkan semua hasil dengan format: "columnOid.index"
        const combinedResults: Record<string, string> = {}
        for (let i = 0; i < resultsArray.length; i++) {
          const columnResults = resultsArray[i]
          const columnOid = columns[i]
          
          for (const [index, value] of Object.entries(columnResults)) {
            // Key format: "columnOid.index" (misalnya: "4.268632320.3")
            combinedResults[`${columnOid}.${index}`] = value
          }
        }
        
        console.log(`[SNMP-Table] Retrieved ${Object.keys(combinedResults).length} entries from ${columns.length} columns`)
        finish(combinedResults)
      }).catch(error => {
        console.error(`[SNMP-Table] Failed:`, error.message || error)
        finish({})
      })

      timeoutId = setTimeout(() => {
        console.warn(`[SNMP-Table] Timeout after ${timeout}ms`)
        finish({})
      }, timeout)
    } catch (error: any) {
      console.error(`[SNMP-Table] Error:`, error.message || error)
      finish({})
    }
  })
}

/**
 * Helper function untuk membandingkan OID secara numerik
 * Membantu untuk sorting dan validasi urutan
 */
function compareOids(oid1: string, oid2: string): number {
  const parts1 = oid1.split('.').map(p => parseInt(p, 10) || 0)
  const parts2 = oid2.split('.').map(p => parseInt(p, 10) || 0)
  
  const maxLength = Math.max(parts1.length, parts2.length)
  
  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0
    const part2 = parts2[i] || 0
    
    if (part1 < part2) return -1
    if (part1 > part2) return 1
  }
  
  return 0
}

/**
 * Validasi urutan OID untuk memastikan tidak ada gap yang signifikan
 * @param results Array of {oid, value, type}
 * @param baseOid Base OID yang digunakan untuk walk
 * @returns Object dengan isValid, gaps, dan warnings
 */
function validateOidSequence(
  results: Array<{ oid: string; value: any; type?: number }>,
  baseOid: string
): { isValid: boolean; gaps: Array<{ from: string; to: string; count: number }>; warnings: string[] } {
  if (results.length === 0) {
    return { isValid: true, gaps: [], warnings: [] }
  }
  
  // Sort results berdasarkan OID
  const sortedResults = [...results].sort((a, b) => compareOids(a.oid, b.oid))
  
  const gaps: Array<{ from: string; to: string; count: number }> = []
  const warnings: string[] = []
  
  // Extract base OID parts untuk validasi
  const baseOidParts = baseOid.split('.').filter(p => p.length > 0)
  const baseOidLength = baseOidParts.length
  
  // Validasi urutan OID
  for (let i = 1; i < sortedResults.length; i++) {
    const prevOid = sortedResults[i - 1].oid
    const currOid = sortedResults[i].oid
    
    const prevParts = prevOid.split('.').filter(p => p.length > 0)
    const currParts = currOid.split('.').filter(p => p.length > 0)
    
    // Hanya validasi jika OID masih dalam base OID yang sama
    if (prevParts.length >= baseOidLength && currParts.length >= baseOidLength) {
      const prevBase = prevParts.slice(0, baseOidLength).join('.')
      const currBase = currParts.slice(0, baseOidLength).join('.')
      
      if (prevBase === currBase && prevBase === baseOid) {
        // Bandingkan index setelah base OID
        const prevIndex = prevParts.slice(baseOidLength)
        const currIndex = currParts.slice(baseOidLength)
        
        // Jika index hanya berbeda 1, itu normal (sequential)
        // Jika berbeda lebih dari 1, ada gap
        if (prevIndex.length === currIndex.length && prevIndex.length > 0) {
          const lastPrev = parseInt(prevIndex[prevIndex.length - 1], 10)
          const lastCurr = parseInt(currIndex[currIndex.length - 1], 10)
          
          if (!isNaN(lastPrev) && !isNaN(lastCurr) && lastCurr - lastPrev > 1) {
            const gapCount = lastCurr - lastPrev - 1
            gaps.push({
              from: prevOid,
              to: currOid,
              count: gapCount
            })
            
            if (gapCount > 10) {
              warnings.push(`Large gap detected: ${gapCount} missing OIDs between ${prevOid} and ${currOid}`)
            }
          }
        }
      }
    }
  }
  
  const isValid = gaps.length === 0 || gaps.every(g => g.count <= 5) // Toleransi gap kecil (<= 5)
  
  return { isValid, gaps, warnings }
}

/**
 * SNMP Walk dengan GetNext - memastikan urutan OID yang konsisten
 * Menggunakan session.getNext() dalam loop untuk memastikan semua data terambil
 * dengan urutan yang benar dan tidak ada yang terlewat
 */
export async function snmpWalkWithGetNext(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 300000,
  expectedCount?: number
): Promise<Array<{ oid: string; value: any; type?: number }>> {
  return new Promise((resolve, reject) => {
    let resolved = false
    let session: any = null
    let timeoutId: NodeJS.Timeout | null = null
    const results: Array<{ oid: string; value: any; type?: number }> = []
    let currentOid: string | null = null
    let isEndOfMibView = false
    let consecutiveErrors = 0
    const maxConsecutiveErrors = 3
    
    const finish = (error?: any) => {
      if (resolved) return
      resolved = true
      
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      
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
      
      if (error) {
        if (results.length > 0) {
          console.log(`[SNMP-GetNext] Completed with ${results.length} results despite error: ${error.message || error}`)
          resolve(results)
        } else {
          reject(error)
        }
      } else {
        // Sort results berdasarkan OID untuk konsistensi
        results.sort((a, b) => compareOids(a.oid, b.oid))
        
        // Validasi urutan OID
        const validation = validateOidSequence(results, oid)
        if (!validation.isValid) {
          console.warn(`[SNMP-GetNext] OID sequence validation found ${validation.gaps.length} gaps`)
          validation.warnings.forEach(w => console.warn(`[SNMP-GetNext] ${w}`))
        }
        
        // Validasi expected count jika diberikan
        if (expectedCount !== undefined && results.length !== expectedCount) {
          const diff = Math.abs(results.length - expectedCount)
          const diffPercentage = (diff / expectedCount) * 100
          
          if (diffPercentage > 5) {
            console.warn(`[SNMP-GetNext] Count mismatch: expected ${expectedCount}, got ${results.length} (${diffPercentage.toFixed(1)}% difference)`)
          } else if (diffPercentage > 1) {
            console.log(`[SNMP-GetNext] Count slight mismatch: expected ${expectedCount}, got ${results.length} (${diffPercentage.toFixed(1)}% difference)`)
          }
        }
        
        console.log(`[SNMP-GetNext] Completed with ${results.length} results${expectedCount ? ` (expected: ${expectedCount})` : ''}`)
        resolve(results)
      }
    }
    
    try {
      let snmpVersion: 0 | 1 | undefined = 1
      if (version === '1') {
        snmpVersion = 0
      } else if (version === '3') {
        console.warn(`[SNMP-GetNext] SNMP v3 is not supported, using v2c instead`)
        snmpVersion = 1
      }
      
      session = snmp.createSession(ipAddress, community, {
        port: port,
        version: snmpVersion,
        retries: 3,
        timeout: 10000,
      })
      
      // Set timeout
      timeoutId = setTimeout(() => {
        if (!resolved) {
          if (results.length > 0) {
            console.log(`[SNMP-GetNext] Timeout reached with ${results.length} results`)
            finish()
          } else {
            finish(new Error('SNMP getNext timeout - no results'))
          }
        }
      }, timeout)
      
      // Normalize OID (remove leading dot if present)
      const normalizedOid = oid.startsWith('.') ? oid.substring(1) : oid
      currentOid = normalizedOid
      
      // Helper function untuk melakukan getNext
      const doGetNext = () => {
        if (resolved || isEndOfMibView || !currentOid) {
          if (isEndOfMibView) {
            console.log(`[SNMP-GetNext] EndOfMibView reached, total results: ${results.length}`)
            finish()
          }
          return
        }
        
        session.getNext([currentOid], (error: any, varbinds: any[]) => {
          if (resolved) return
          
          if (error) {
            consecutiveErrors++
            if (consecutiveErrors >= maxConsecutiveErrors) {
              console.warn(`[SNMP-GetNext] ${maxConsecutiveErrors} consecutive errors, stopping...`)
              finish(new Error(`SNMP getNext failed after ${maxConsecutiveErrors} consecutive errors: ${error.message || error}`))
              return
            }
            
            // Retry dengan delay kecil
            setTimeout(() => {
              if (!resolved) {
                doGetNext()
              }
            }, 500)
            return
          }
          
          consecutiveErrors = 0 // Reset error counter
          
          if (!varbinds || varbinds.length === 0) {
            finish(new Error('SNMP getNext returned no varbinds'))
            return
          }
          
          const varbind = varbinds[0]
          
          // Check untuk EndOfMibView
          if (snmp.isVarbindError(varbind)) {
            if (varbind.type === snmp.ObjectType.EndOfMibView) {
              isEndOfMibView = true
              console.log(`[SNMP-GetNext] EndOfMibView reached, total results: ${results.length}`)
              finish()
              return
            }
            // Skip error varbinds yang bukan EndOfMibView
            finish(new Error(`SNMP getNext error: ${varbind.type}`))
            return
          }
          
          const nextOid = varbind.oid.toString()
          
          // Check apakah OID masih dalam subtree yang diinginkan
          if (!nextOid.startsWith(normalizedOid)) {
            // OID sudah keluar dari subtree, selesai
            console.log(`[SNMP-GetNext] OID ${nextOid} is outside subtree ${normalizedOid}, stopping...`)
            finish()
            return
          }
          
          // Check expected count jika diberikan
          if (expectedCount !== undefined && results.length >= expectedCount) {
            console.log(`[SNMP-GetNext] Reached expected count (${expectedCount}), stopping...`)
            finish()
            return
          }
          
          // Tambahkan hasil
          if (varbind.value !== null && varbind.value !== undefined) {
            results.push({
              oid: nextOid,
              value: varbind.value,
              type: varbind.type,
            })
            
            // Log progress setiap 50 atau 100 entries untuk tracking
            if (results.length % 50 === 0 || results.length % 100 === 0) {
              console.log(`[SNMP-GetNext] Progress: ${results.length} results collected...`)
            }
            
            // Log progress lebih sering untuk dataset besar (> 500)
            if (expectedCount && expectedCount > 500 && results.length % 200 === 0) {
              console.log(`[SNMP-GetNext] Progress: ${results.length}/${expectedCount} results collected (${((results.length / expectedCount) * 100).toFixed(1)}%)...`)
            }
          }
          
          // Update currentOid untuk getNext berikutnya
          currentOid = nextOid
          
          // Lakukan getNext berikutnya dengan delay kecil untuk mengurangi beban
          // Delay lebih kecil untuk performa lebih baik, tapi tetap memberi waktu untuk OLT
          setTimeout(() => {
            if (!resolved && !isEndOfMibView) {
              doGetNext()
            }
          }, 10) // 10ms delay antar getNext (dikurangi dari 50ms untuk performa lebih baik)
        })
      }
      
      // Mulai getNext loop
      console.log(`[SNMP-GetNext] Starting getNext walk for OID: ${normalizedOid}${expectedCount ? ` (expected: ${expectedCount})` : ''}`)
      doGetNext()
      
    } catch (error: any) {
      finish(error)
    }
  })
}

/**
 * SNMP Walk - robust version dengan stability check dan validasi expected count
 */
export async function snmpWalk(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 60000,
  maxResults?: number,
  expectedCount?: number
): Promise<Array<{ oid: string; value: any; type?: number }>> {
  return new Promise((resolve, reject) => {
    let resolved = false
    let session: any = null
    let timeoutId: NodeJS.Timeout | null = null
    let stableCheckTimeout: NodeJS.Timeout | null = null
    let batchProcessingTimeout: NodeJS.Timeout | null = null
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
      
      // Clear batch processing timeout
      if (batchProcessingTimeout) {
        clearTimeout(batchProcessingTimeout)
        batchProcessingTimeout = null
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
      const maxHistorySize = 4 // Track 4 checks terakhir
      let stabilityCheckStartTime: number | null = null
      const checkInterval = 3000 // 3 detik default untuk stability check interval
      
      const checkStability = () => {
        if (resolved || isClosing) return
        
        // Tambahkan current count ke history
        resultHistory.push(results.length)
        if (resultHistory.length > maxHistorySize) {
          resultHistory.shift() // Hapus yang paling lama
        }
        
        // Validasi expected count jika diberikan
        if (expectedCount !== undefined && results.length >= expectedCount) {
          console.log(`[SNMP-Walk] Reached expected count (${expectedCount}), completing...`)
          finish()
          return
        }
        
        if (results.length === lastResultCount) {
          stableCount++
          
          // Set start time jika belum di-set
          if (stabilityCheckStartTime === null) {
            stabilityCheckStartTime = Date.now()
          }
          
          // Adaptive stability check berdasarkan dataset size dan expected count
          let requiredStableChecks = 2 // Default 2 checks
          let minStableTime = 3000 // Minimal 3 detik untuk dataset kecil
          
          // Untuk dataset besar atau jika ada expected count, tunggu lebih lama
          if (expectedCount !== undefined && expectedCount > 500) {
            requiredStableChecks = 5 // 5 checks = 15 detik untuk dataset besar dengan expected count
            minStableTime = 5000 // Minimal 5 detik
          } else if (results.length > 500) {
            requiredStableChecks = 5 // 5 checks = 15 detik untuk dataset besar
            minStableTime = 5000 // Minimal 5 detik
          } else if (results.length > 300) {
            requiredStableChecks = 4 // 4 checks = 12 detik
            minStableTime = 4000 // Minimal 4 detik
          } else if (results.length > 100) {
            requiredStableChecks = 3 // 3 checks = 9 detik
            minStableTime = 3000 // Minimal 3 detik
          } else {
            // Untuk dataset kecil (< 100), gunakan 2 checks (6 detik)
            requiredStableChecks = 2
            minStableTime = 3000 // Minimal 3 detik
          }
          
          // Cek apakah data masih terus masuk dalam history
          if (resultHistory.length >= 2) {
            const recentGrowth = resultHistory[resultHistory.length - 1] - resultHistory[resultHistory.length - 2]
            const growthPercentage = resultHistory[resultHistory.length - 2] > 0 
              ? (recentGrowth / resultHistory[resultHistory.length - 2]) * 100 
              : 0
            
            // Jika growth >= 1%, data masih terus masuk dengan signifikan
            if (recentGrowth > 0 && growthPercentage >= 1) {
              // Data masih terus masuk dengan signifikan, reset stableCount
              console.log(`[SNMP-Walk] Data still growing (${recentGrowth} new results, ${growthPercentage.toFixed(1)}% growth in last ${resultHistory.length * 3}s), continuing...`)
              stableCount = Math.max(0, stableCount - 1) // Kurangi sedikit
              stabilityCheckStartTime = null // Reset start time
            } else if (recentGrowth > 0 && growthPercentage < 1) {
              // Growth sangat kecil (< 1%), anggap sudah stable
              console.log(`[SNMP-Walk] Data growth minimal (${recentGrowth} new results, ${growthPercentage.toFixed(1)}% growth), considering stable...`)
            }
          }
          
          // Cek maksimal wait time berdasarkan dataset size
          const MAX_STABILITY_WAIT_TIME = results.length > 500 ? 60000 : 30000 // 60 detik untuk dataset besar, 30 detik untuk kecil
          const elapsedTime = stabilityCheckStartTime ? Date.now() - stabilityCheckStartTime : 0
          
          // Jika ada expected count dan belum tercapai, tunggu lebih lama
          if (expectedCount !== undefined && results.length < expectedCount) {
            const missing = expectedCount - results.length
            const missingPercentage = (missing / expectedCount) * 100
            
            // Jika masih missing > 5%, tunggu lebih lama
            if (missingPercentage > 5 && elapsedTime < MAX_STABILITY_WAIT_TIME * 2) {
              console.log(`[SNMP-Walk] Still missing ${missing} results (${missingPercentage.toFixed(1)}%), waiting longer...`)
              stableCount = Math.max(0, stableCount - 1) // Reset stable count untuk menunggu lebih lama
              stabilityCheckStartTime = null
            }
          }
          
          if (elapsedTime >= MAX_STABILITY_WAIT_TIME) {
            console.log(`[SNMP-Walk] Max stability wait time reached (${MAX_STABILITY_WAIT_TIME/1000}s), completing with ${results.length} results${expectedCount ? ` (expected: ${expectedCount})` : ''}`)
            finish()
            return
          }
          
          // Pastikan minimal stable time tercapai
          if (elapsedTime >= minStableTime && stableCount >= requiredStableChecks) {
            const totalWaitTime = requiredStableChecks * (checkInterval / 1000)
            console.log(`[SNMP-Walk] Stable (no new results for ${totalWaitTime}s), completing with ${results.length} results${expectedCount ? ` (expected: ${expectedCount})` : ''}`)
            
            // Warning jika expected count tidak tercapai
            if (expectedCount !== undefined && results.length < expectedCount) {
              const missing = expectedCount - results.length
              const missingPercentage = (missing / expectedCount) * 100
              console.warn(`[SNMP-Walk] WARNING: Expected ${expectedCount} results but got ${results.length} (missing ${missing}, ${missingPercentage.toFixed(1)}%)`)
            }
            
            finish()
            return
          }
        } else {
          // Data masih masuk, reset stableCount dan start time
          stableCount = 0
          stabilityCheckStartTime = null
          lastResultCount = results.length
          if (results.length > 0 && (results.length % 50 === 0 || results.length % 100 === 0)) {
            console.log(`[SNMP-Walk] Progress: ${results.length} results collected${expectedCount ? `/${expectedCount}` : ''}...`)
          }
        }
        
        if (!resolved && !isClosing) {
          stableCheckTimeout = setTimeout(checkStability, checkInterval)
        }
      }

      // Batch processing: pause setiap 20 entries untuk mengurangi beban SNMP
      const BATCH_SIZE = 20 // Process 20 entries per batch
      let isProcessingBatch = false
      let pendingVarbinds: any[] = []
      // batchProcessingTimeout sudah dideklarasikan di scope luar
      
      // Normalize OID untuk validasi subtree
      const normalizedOidForValidation = oid.startsWith('.') ? oid.substring(1) : oid
      
      const processBatch = () => {
        if (isProcessingBatch || pendingVarbinds.length === 0) {
          if (pendingVarbinds.length === 0 && !isProcessingBatch) {
            checkStability()
          }
          return
        }
        if (resolved || isClosing) return
        
        isProcessingBatch = true
        const batch = pendingVarbinds.splice(0, BATCH_SIZE)
        
        // Process batch dengan validasi subtree
        for (const varbind of batch) {
          if (snmp.isVarbindError(varbind)) {
            if (varbind.type === snmp.ObjectType.EndOfMibView) {
              console.log(`[SNMP-Walk] EndOfMibView reached, total results: ${results.length}`)
              finish()
              isProcessingBatch = false
              if (batchProcessingTimeout) {
                clearTimeout(batchProcessingTimeout)
                batchProcessingTimeout = null
              }
              return
            }
            continue
          }

          // Validasi: pastikan OID masih dalam subtree yang diinginkan
          // Ini memastikan tidak mengambil data di luar OID target
          const varbindOid = varbind.oid.toString()
          if (!varbindOid.startsWith(normalizedOidForValidation)) {
            // OID sudah keluar dari subtree, stop processing batch ini
            console.log(`[SNMP-Walk] OID ${varbindOid} is outside subtree ${normalizedOidForValidation}, stopping walk...`)
            finish()
            isProcessingBatch = false
            if (batchProcessingTimeout) {
              clearTimeout(batchProcessingTimeout)
              batchProcessingTimeout = null
            }
            return
          }

          if (varbind.value !== null && varbind.value !== undefined) {
            results.push({
              oid: varbindOid,
              value: varbind.value,
              type: varbind.type,
            })
            
            if (maxResults && results.length >= maxResults) {
              console.log(`[SNMP-Walk] Reached maxResults (${maxResults}), stopping early...`)
              finish()
              isProcessingBatch = false
              if (batchProcessingTimeout) {
                clearTimeout(batchProcessingTimeout)
                batchProcessingTimeout = null
              }
              return
            }
          }
        }
        
        // Log progress setiap batch
        if (results.length % 20 === 0 || results.length % 100 === 0) {
          console.log(`[SNMP-Walk] Processed batch: ${results.length} results collected...`)
        }
        
        isProcessingBatch = false
        
        // Pause sebentar (200ms) untuk mengurangi beban SNMP sebelum lanjut batch berikutnya
        if (pendingVarbinds.length > 0) {
          if (batchProcessingTimeout) {
            clearTimeout(batchProcessingTimeout)
          }
          batchProcessingTimeout = setTimeout(() => {
            batchProcessingTimeout = null
            processBatch() // Process batch berikutnya
          }, 200) // 200ms delay antar batch
        } else {
          checkStability()
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
          // Process sisa batch jika ada
          if (pendingVarbinds.length > 0) {
            processBatch()
          } else {
            checkStability()
          }
          return
        }

        // Tambahkan varbinds ke pending queue untuk batch processing
        pendingVarbinds.push(...varbinds)
        
        // Process batch jika belum sedang processing
        if (!isProcessingBatch) {
          processBatch()
        }
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
        console.log(`[SNMP-Walk] Using subtree for OID: ${oidString} (will only fetch data within this subtree)`)
        session.subtree(oidString, wrappedCallback)
      } catch (subtreeError: any) {
        console.error(`[SNMP-Walk] Error calling session.subtree:`, subtreeError?.message || String(subtreeError))
        finish(subtreeError)
        return
      }
      
      setTimeout(checkStability, 1000) // Mulai check lebih cepat (1 detik, bukan 2 detik)
    } catch (error: any) {
      finish(error)
    }
  })
}

/**
 * SNMP Walk Simple - mengembalikan Record<string, string>
 * Menggunakan subtree dengan fallback ke getNext jika hasil tidak lengkap
 */
export async function snmpWalkSimple(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 120000,
  maxResults?: number,
  expectedCount?: number
): Promise<Record<string, string>> {
  // Coba menggunakan subtree terlebih dahulu
  let walkResults = await snmpWalk(ipAddress, port, community, version, oid, timeout, maxResults, expectedCount)
  
  // Validasi hasil: jika ada expected count dan tidak sesuai, coba dengan getNext
  if (expectedCount !== undefined && walkResults.length < expectedCount) {
    const missing = expectedCount - walkResults.length
    const missingPercentage = (missing / expectedCount) * 100
    
    // Jika missing > 5%, coba dengan getNext untuk memastikan semua data terambil
    if (missingPercentage > 5) {
      console.log(`[SNMP-WalkSimple] Subtree incomplete (got ${walkResults.length}, expected ${expectedCount}, missing ${missingPercentage.toFixed(1)}%), trying getNext...`)
      
      try {
        const getNextResults = await snmpWalkWithGetNext(
          ipAddress,
          port,
          community,
          version,
          oid,
          timeout,
          expectedCount
        )
        
        // Gunakan hasil getNext jika lebih lengkap
        if (getNextResults.length >= walkResults.length) {
          console.log(`[SNMP-WalkSimple] GetNext returned ${getNextResults.length} results (vs ${walkResults.length} from subtree), using getNext results`)
          walkResults = getNextResults
        } else {
          console.log(`[SNMP-WalkSimple] GetNext returned fewer results (${getNextResults.length} vs ${walkResults.length}), keeping subtree results`)
        }
      } catch (getNextError: any) {
        console.warn(`[SNMP-WalkSimple] GetNext fallback failed: ${getNextError.message || getNextError}, using subtree results`)
        // Gunakan hasil subtree meskipun tidak lengkap
      }
    }
  }
  
  // Sort results berdasarkan OID untuk konsistensi
  walkResults.sort((a, b) => compareOids(a.oid, b.oid))
  
  // Validasi urutan OID
  const validation = validateOidSequence(walkResults, oid)
  if (!validation.isValid) {
    console.warn(`[SNMP-WalkSimple] OID sequence validation found ${validation.gaps.length} gaps`)
    validation.warnings.forEach(w => console.warn(`[SNMP-WalkSimple] ${w}`))
  }
  
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
  
  // Log final count
  if (expectedCount !== undefined) {
    const finalCount = Object.keys(results).length
    if (finalCount !== expectedCount) {
      const diff = Math.abs(finalCount - expectedCount)
      const diffPercentage = (diff / expectedCount) * 100
      if (diffPercentage > 1) {
        console.warn(`[SNMP-WalkSimple] Final count mismatch: expected ${expectedCount}, got ${finalCount} (${diffPercentage.toFixed(1)}% difference)`)
      }
    }
  }
  
  return results
}

/**
 * SNMP GetBulk Simple - wrapper untuk snmpWalkSimple dengan interface yang sama
 * Untuk kompatibilitas dengan kode yang sudah menggunakan snmpGetBulkSimple
 */
export async function snmpGetBulkSimple(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 30000,
  maxResults?: number,
  expectedCount?: number
): Promise<Record<string, string>> {
  // Gunakan snmpWalkSimple sebagai implementasi
  return await snmpWalkSimple(ipAddress, port, community, version, oid, timeout, maxResults, expectedCount)
}

