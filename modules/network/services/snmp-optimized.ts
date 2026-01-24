/**
 * Optimized SNMP utilities untuk handling large ONU data
 * Menggunakan GETBULK (bukan WALK), pagination, dan caching untuk improve performance
 */

import snmp from 'net-snmp'
import { snmpGetBulkSimple } from '@/lib/utils/snmp-helpers'
import { onuCacheService } from './onu-cache-service'

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_CHUNK_SIZE = 50 // Max ONU per chunk
const SNMP_TIMEOUT = 180000 // 180 seconds (3 minutes) untuk dataset besar
const STATUS_CACHE_TTL = 30 * 60 * 1000 // 30 minutes untuk status data (total count)
const MAX_CONCURRENT_SESSIONS = 3

interface CacheEntry {
  data: Record<string, string>
  timestamp: number
}

interface SNMPSession {
  session: any
  inUse: boolean
  lastUsed: number
}

class SNMPConnectionPool {
  private sessions: Map<string, SNMPSession[]> = new Map()
  private maxSessions = MAX_CONCURRENT_SESSIONS

  async getSession(
    ipAddress: string,
    port: number,
    community: string,
    version: string
  ): Promise<any> {
    const key = `${ipAddress}:${port}:${community}:${version}`

    if (!this.sessions.has(key)) {
      this.sessions.set(key, [])
    }

    const sessionList = this.sessions.get(key)!

    // Try to find an unused session
    let availableSession = sessionList.find(s => !s.inUse &&
      (Date.now() - s.lastUsed) < 30000) // Reuse if less than 30s old

    if (!availableSession && sessionList.length < this.maxSessions) {
      // Create new session
      let snmpVersion: 0 | 1 | undefined = 1 // Default: Version2c
      if (version === '1') {
        snmpVersion = 0
      } else if (version === '3') {
        snmpVersion = 1 // Fallback to Version2c
      }

      const session = snmp.createSession(ipAddress, community, {
        port,
        version: snmpVersion,
        retries: 2,
        timeout: SNMP_TIMEOUT,
      })

      availableSession = {
        session,
        inUse: false,
        lastUsed: Date.now()
      }

      sessionList.push(availableSession)
    }

    if (!availableSession) {
      // Wait for available session
      await new Promise(resolve => setTimeout(resolve, 100))
      return this.getSession(ipAddress, port, community, version)
    }

    availableSession.inUse = true
    availableSession.lastUsed = Date.now()

    return availableSession.session
  }

  releaseSession(session: any) {
    for (const [key, sessionList] of this.sessions.entries()) {
      const found = sessionList.find(s => s.session === session)
      if (found) {
        found.inUse = false
        break
      }
    }
  }

  cleanup() {
    for (const [key, sessionList] of this.sessions.entries()) {
      for (const snmpSession of sessionList) {
        try {
          snmpSession.session.close()
        } catch (e) {
          // Ignore
        }
      }
    }
    this.sessions.clear()
  }
}

const connectionPool = new SNMPConnectionPool()

// OPTIMIZATION: Use LRU cache instead of unbounded Map to prevent memory leaks
import { LRUCache } from '@/lib/utils/lru-cache'

interface CacheValue {
  data: Record<string, string>
}

// LRU Cache with max 100 entries and 5 minute TTL
const cache = new LRUCache<string, CacheValue>(100, CACHE_TTL)

// Periodic cleanup for expired entries (every 60 seconds)
setInterval(() => {
  const removed = cache.cleanup()
  if (removed > 0) {
    console.log(`[SNMP Cache] Cleaned up ${removed} expired entries. Current size: ${cache.size}`)
  }
}, 60000)

// Cache helper functions
function getCacheKey(ipAddress: string, oid: string): string {
  return `${ipAddress}:${oid}`
}

function getFromCache(key: string): Record<string, string> | null {
  const entry = cache.get(key)
  if (entry) {
    return entry.data
  }
  return null
}

function setCache(key: string, data: Record<string, string>): void {
  cache.set(key, { data })
}

// Optimized SNMP fetch menggunakan GETBULK (lebih efisien daripada WALK)
export async function snmpWalkOptimized(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  options: {
    timeout?: number
    useCache?: boolean
    chunkSize?: number
  } = {}
): Promise<Record<string, string>> {
  const {
    timeout = SNMP_TIMEOUT,
    useCache = true,
    chunkSize = MAX_CHUNK_SIZE
  } = options

  const cacheKey = getCacheKey(ipAddress, oid)

  // Try cache first
  if (useCache) {
    const cached = getFromCache(cacheKey)
    if (cached) {
      console.log(`[SNMP-Optimized] Cache hit for ${oid} (${Object.keys(cached).length} items)`)
      return cached
    }
  }

  console.log(`[SNMP-Optimized] Starting SNMP GETBULK for ${oid}...`)
  const startTime = Date.now()

  try {
    // Gunakan GETBULK untuk lebih efisien daripada WALK
    const results = await snmpGetBulkSimple(ipAddress, port, community, version, oid, timeout)

    // Cache the results
    if (useCache && Object.keys(results).length > 0) {
      setCache(cacheKey, results)
    }

    const duration = Date.now() - startTime
    console.log(`[SNMP-Optimized] GETBULK completed for ${oid} (${Object.keys(results).length} items, ${duration}ms)`)

    return results
  } catch (error: any) {
    console.error(`[SNMP-Optimized] GETBULK failed for ${oid}:`, error.message || error)
    // Fallback ke WALK dengan chunking jika GETBULK gagal
    console.log(`[SNMP-Optimized] Falling back to WALK with chunking...`)
    const session = await connectionPool.getSession(ipAddress, port, community, version)
    try {
      const results = await snmpWalkWithChunking(session, oid, chunkSize, timeout)
      if (useCache && Object.keys(results).length > 0) {
        setCache(cacheKey, results)
      }
      return results
    } finally {
      connectionPool.releaseSession(session)
    }
  }
}

// SNMP walk dengan chunking untuk data besar
async function snmpWalkWithChunking(
  session: any,
  oid: string,
  chunkSize: number,
  timeout: number
): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let resolved = false
    const results: Record<string, string> = {}
    let currentChunk: Record<string, string> = {}
    let chunkCount = 0

    const finish = (error?: any) => {
      if (resolved) return
      resolved = true

      if (error) {
        // If error but have results, return results
        if (Object.keys(results).length > 0) {
          resolve(results)
        } else {
          reject(error)
        }
      } else {
        resolve(results)
      }
    }

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        console.log(`[SNMP-Optimized] Timeout reached, returning ${Object.keys(results).length} results`)
        finish()
      }
    }, timeout)

    const processCallback = (error: any, varbinds: any[]) => {
      if (resolved) return

      // Handle net-snmp bug
      if (error && Array.isArray(error) && error.length > 0 && error[0]?.oid) {
        varbinds = error
        error = null
      }

      if (error) {
        console.warn(`[SNMP-Optimized] SNMP walk error: ${error?.message || error}`)
        // If error but have results, don't fail immediately
        if (Object.keys(results).length > 0) {
          finish()
          return
        }
      }

      if (!varbinds || varbinds.length === 0) {
        finish()
        return
      }

      for (const varbind of varbinds) {
        if (snmp.isVarbindError(varbind)) {
          if (varbind.type === snmp.ObjectType.EndOfMibView) {
            finish()
            return
          }
          continue
        }

        if (varbind.value !== null && varbind.value !== undefined) {
          const oidStr = varbind.oid.toString()
          let valueStr: string

          if (Buffer.isBuffer(varbind.value)) {
            valueStr = Array.from(varbind.value as Uint8Array)
              .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
              .join(' ')
          } else {
            valueStr = varbind.value.toString()
          }

          currentChunk[oidStr] = valueStr
        }
      }

      // Add chunk to results if it reaches chunk size
      if (Object.keys(currentChunk).length >= chunkSize) {
        chunkCount++
        console.log(`[SNMP-Optimized] Processing chunk ${chunkCount} (${Object.keys(currentChunk).length} items)`)

        Object.assign(results, currentChunk)
        currentChunk = {}
      }
    }

    const wrappedCallback = (error: any, varbinds: any[]) => {
      try {
        processCallback(error, varbinds)
      } catch (callbackError: any) {
        console.error(`[SNMP-Optimized] Callback error:`, callbackError?.message)
        if (Object.keys(results).length > 0) {
          finish()
        }
      }
    }

    try {
      session.subtree(oid, wrappedCallback)
    } catch (subtreeError: any) {
      console.error(`[SNMP-Optimized] Subtree error:`, subtreeError?.message)
      finish(subtreeError)
      return
    }

    // Cleanup timeout
    setTimeout(() => {
      clearTimeout(timeoutId)
    }, timeout + 1000)
  })
}

// Optimized ONU data fetching dengan pagination
export async function fetchOnuDataPaginated(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltId: string,
  page: number = 1,
  pageSize: number = 100
): Promise<{
  data: Array<{
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
  }>
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}> {
  // OID definitions
  const baseOid = "1.3.6.1.4.1.3902.1012.3.28.1.1"
  const oidStatusNew = "1.3.6.1.4.1.3902.1012.3.28.2.1.4"
  const oidName = `${baseOid}.2`
  const oidDesc = "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3"
  const oidRxOltNew = "1.3.6.1.4.1.3902.1015.1010.11.2.1.2"
  const oidRxOnuNew = "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10"
  const oidSN = `${baseOid}.5`
  const oidActualType = "1.3.6.1.4.1.3902.1012.3.50.11.2.1.9"
  const oidPppoe = "1.3.6.1.4.1.3902.1082.500.20.2.17.2.1.11"

  // Fetch status data dengan cache (untuk total count) - ini tidak berubah sering
  // Cache key khusus untuk status dengan TTL lebih lama
  const statusCacheKey = getCacheKey(ipAddress, oidStatusNew)
  let statusData: Record<string, string> | null = getFromCache(statusCacheKey)

  // Jika cache expired atau tidak ada, fetch baru
  if (!statusData) {
    console.log(`[SNMP-Optimized] Fetching status data (total count) for pagination...`)
    statusData = await snmpWalkOptimized(ipAddress, port, community, version, oidStatusNew, {
      useCache: false, // Don't use normal cache, we'll cache manually with longer TTL
      timeout: SNMP_TIMEOUT
    }).catch(() => ({}))

    if (Object.keys(statusData).length === 0) {
      // Fallback to old status OID
      const baseOid = "1.3.6.1.4.1.3902.1012.3.28.1.1"
      const oidStatusOld = `${baseOid}.6`
      statusData = await snmpWalkOptimized(ipAddress, port, community, version, oidStatusOld, {
        useCache: false,
        timeout: SNMP_TIMEOUT
      }).catch(() => ({}))
    }

    // Cache status data
    if (statusData && Object.keys(statusData).length > 0) {
      setCache(statusCacheKey, statusData)
      console.log(`[SNMP-Optimized] Cached status data (${Object.keys(statusData).length} ONUs)`)
    }
  } else {
    console.log(`[SNMP-Optimized] Using cached status data (${Object.keys(statusData).length} ONUs)`)
  }

  const totalOnus = Object.keys(statusData).length

  if (totalOnus === 0) {
    return {
      data: [],
      pagination: {
        page: 1,
        pageSize,
        total: 0,
        totalPages: 0
      }
    }
  }

  // Calculate pagination
  const totalPages = Math.ceil(totalOnus / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalOnus)
  const indexes = Object.keys(statusData).slice(startIndex, endIndex)

  console.log(`[SNMP-Optimized] Fetching page ${page}/${totalPages} (${indexes.length} ONUs)`)

  // Fetch data dengan timeout lebih lama untuk dataset besar
  // Gunakan cache untuk mengurangi beban SNMP
  const dataTimeout = totalOnus > 500 ? SNMP_TIMEOUT : 60000 // 3 min untuk besar, 1 min untuk kecil
  console.log(`[SNMP-Optimized] Fetching ONU data with timeout ${dataTimeout / 1000}s (total ONUs: ${totalOnus})`)

  const [nameData, descData, rxOltData, rxOnuData, snData, actualTypeData, pppoeData] = await Promise.all([
    snmpWalkOptimized(ipAddress, port, community, version, oidName, { useCache: true, timeout: dataTimeout }).catch(() => ({})),
    snmpWalkOptimized(ipAddress, port, community, version, oidDesc, { useCache: true, timeout: dataTimeout }).catch(() => ({})),
    snmpWalkOptimized(ipAddress, port, community, version, oidRxOltNew, { useCache: true, timeout: dataTimeout }).catch(() => ({})),
    snmpWalkOptimized(ipAddress, port, community, version, oidRxOnuNew, { useCache: true, timeout: dataTimeout }).catch(() => ({})),
    snmpWalkOptimized(ipAddress, port, community, version, oidSN, { useCache: true, timeout: dataTimeout }).catch(() => ({})),
    snmpWalkOptimized(ipAddress, port, community, version, oidActualType, { useCache: true, timeout: dataTimeout }).catch(() => ({})),
    snmpWalkOptimized(ipAddress, port, community, version, oidPppoe, { useCache: true, timeout: dataTimeout }).catch(() => ({}))
  ])

  // Process hanya indexes yang diperlukan
  const data = []
  if (!statusData) {
    statusData = {}
  }
  for (const idx of indexes) {
    const statusValue = statusData[idx] || ""
    const nameValue = (nameData as Record<string, string>)[idx] || ""
    const descValue = (descData as Record<string, string>)[idx] || ""
    const rxOltValue = (rxOltData as Record<string, string>)[idx] || ""
    let rxOnuValue = (rxOnuData as Record<string, string>)[idx] || ""

    // Handle RX ONU index format
    if (!rxOnuValue) {
      const idxWithOne = `${idx}.1`
      rxOnuValue = (rxOnuData as Record<string, string>)[idxWithOne] || ""
    }

    const snValue = (snData as Record<string, string>)[idx] || ""
    const actualTypeValue = (actualTypeData as Record<string, string>)[idx] || ""
    let pppoeValue = (pppoeData as Record<string, string>)[idx] || ""

    // Find PPPoE by onu_id if not found directly
    if (!pppoeValue) {
      const indexParts = idx.split('.')
      if (indexParts.length >= 2) {
        const onuId = indexParts[1]
        const matchingKeys = Object.keys(pppoeData as Record<string, string>).filter(k => k.endsWith(`.${onuId}`))
        if (matchingKeys.length > 0) {
          pppoeValue = (pppoeData as Record<string, string>)[matchingKeys[0]] || ""
        }
      }
    }

    // Process data (simplified version, you may want to use the full processing logic)
    const statusNum = parseInt(statusValue, 10)
    let statusStr = 'Unknown'
    if (statusNum === 1) statusStr = 'LOS'
    else if (statusNum === 3) statusStr = 'Online'
    else if (statusNum === 4) statusStr = 'DyingGasp'
    else if (statusNum === 6) statusStr = 'OffLine'

    // Parse RX values
    const rxOltNum = parseInt(rxOltValue, 10)
    let rxOltStr = "N/A"
    if (!isNaN(rxOltNum) && rxOltNum > -80000) {
      rxOltStr = `${(rxOltNum / 1000).toFixed(3)} dBm`
    }

    const rxOnuNum = parseInt(rxOnuValue, 10)
    let rxOnuStr = "N/A"
    if (!isNaN(rxOnuNum) && rxOnuNum > 0 && rxOnuNum !== 65535) {
      const dbmValue = -30 + (rxOnuNum * 0.002)
      rxOnuStr = `${dbmValue.toFixed(3)} dBm`
    }

    // Parse GPON ONU ID
    const indexParts = idx.split('.')
    let gponOnu = `idx-${idx}`
    if (indexParts.length >= 2) {
      const compositeIndex = parseInt(indexParts[0], 10)
      const onuId = indexParts[1]

      if (!isNaN(compositeIndex)) {
        const shelf = (compositeIndex >> 24) & 0xF
        const slot = (compositeIndex >> 16) & 0xFF
        const port = (compositeIndex >> 8) & 0xFF
        const frame = shelf === 0 ? 1 : shelf
        gponOnu = `${frame}/${slot}/${port}:${onuId}`
      }
    }

    data.push({
      oltId,
      name: nameValue || `ONU-${indexParts[1]}`,
      description: descValue || null,
      pppoe: pppoeValue || null,
      gponOnu,
      status: statusStr,
      rxOlt: rxOltStr,
      rxOnu: rxOnuStr,
      serialNumber: snValue || null,
      actualType: actualTypeValue || null
    })
  }

  return {
    data,
    pagination: {
      page,
      pageSize,
      total: totalOnus,
      totalPages
    }
  }
}

// Clear cache utility
export function clearSNMPCache(): void {
  cache.clear()
  console.log('[SNMP-Optimized] Cache cleared')
}

// Cleanup function untuk connection pool
export function cleanupSNMPConnections(): void {
  connectionPool.cleanup()
  clearSNMPCache()
}

// Auto-cleanup saat process exit
if (typeof process !== 'undefined') {
  process.on('SIGINT', cleanupSNMPConnections)
  process.on('SIGTERM', cleanupSNMPConnections)
  process.on('beforeExit', cleanupSNMPConnections)
}