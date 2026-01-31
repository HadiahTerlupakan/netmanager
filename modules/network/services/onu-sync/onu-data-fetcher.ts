import { snmpGetBulkSimple } from '@/lib/utils/snmp-helpers'
import { buildGponPortMap } from './onu-sync-helpers'
import { SNMPOIDCollector } from './snmp-oid-collector'
import { ONUDataParser } from './onu-data-parser'
import { PerformanceOptimizer } from './performance-optimizer'
import type { OnuSyncData } from '@/lib/types/onu-sync'

export interface OnuFetchRequest {
  ipAddress: string
  port: number
  community: string
  version: string
  oltId: string
  maxResults?: number
}

export class ONUDataFetcher {
  private oidCollector: SNMPOIDCollector
  private dataParser: ONUDataParser
  private optimizer: PerformanceOptimizer

  constructor() {
    this.oidCollector = new SNMPOIDCollector()
    this.dataParser = new ONUDataParser()
    this.optimizer = new PerformanceOptimizer()
  }

  /**
   * Count ONUs using optimized approach
   */
  async countOnus(
    ipAddress: string,
    port: number,
    community: string,
    version: string
  ): Promise<number> {
    const statusOID = this.oidCollector.getOID('statusNew')
    const statusData = await snmpGetBulkSimple(ipAddress, port, community, version, statusOID, 300000)
    return Object.keys(statusData).length
  }

  /**
   * Main function to fetch all ONU data
   */
  async fetchOnuData(request: OnuFetchRequest): Promise<Array<OnuSyncData>> {
    const { ipAddress, port, community, version, oltId, maxResults } = request

    console.log(`[ONU-DataFetcher] Starting optimized data fetch...`)

    // Step 1: Build GPON port map
    const gponPortMap = await buildGponPortMap(ipAddress, port, community, version)

    // Step 2: Optimized SNMP data fetching
    const snmpData = await this.fetchOptimizedSNMPData(ipAddress, port, community, version)

    // Step 3: Early exit if no ONUs found
    if (this.isEmptyDataSet(snmpData)) {
      console.log(`[ONU-DataFetcher] No ONUs found, early exit`)
      return []
    }

    // Step 4: Parse and process ONU data
    const onuData = await this.dataParser.parseONUData({
      rawData: snmpData,
      gponPortMap,
      oltId,
      maxResults
    })

    // Step 5: Apply performance optimizations
    const optimizedData = this.optimizer.optimizeData(onuData)

    this.logPerformanceMetrics(snmpData, optimizedData)

    return optimizedData
  }

  /**
   * Optimized SNMP data fetching with batching
   */
  private async fetchOptimizedSNMPData(
    ipAddress: string,
    port: number,
    community: string,
    version: string
  ): Promise<Record<string, Record<string, string>>> {
    console.log(`[ONU-DataFetcher] Starting optimized SNMP fetching...`)

    // Batch 1: Critical data for existence check
    const criticalBatch = await this.fetchCriticalData(ipAddress, port, community, version)

    // Early exit check
    if (this.isEmptyDataSet(criticalBatch)) {
      console.log(`[ONU-DataFetcher] No critical data found, skipping optional queries`)
      return criticalBatch
    }

    // Batch 2: Additional important data
    const additionalBatch = await this.fetchAdditionalData(ipAddress, port, community, version)

    // Batch 3: Optional data (non-blocking)
    const optionalBatch = await this.fetchOptionalData(ipAddress, port, community, version)

    return {
      ...criticalBatch,
      ...additionalBatch,
      ...optionalBatch
    }
  }

  /**
   * Fetch critical data required for ONU existence
   */
  private async fetchCriticalData(
    ipAddress: string,
    port: number,
    community: string,
    version: string
  ): Promise<Record<string, Record<string, string>>> {
    const criticalOIDs = ['statusNew', 'serialNumber']

    const promises = criticalOIDs.map(async (oidName) => {
      const oid = this.oidCollector.getOID(oidName)
      const altOid = this.oidCollector.getAlternativeOID(oidName)

      const data = await this.fetchWithFallback(ipAddress, port, community, version, oid, altOid, oidName)
      return [oidName, data]
    })

    const results = await Promise.all(promises)
    return Object.fromEntries(results)
  }

  /**
   * Fetch additional important data
   */
  private async fetchAdditionalData(
    ipAddress: string,
    port: number,
    community: string,
    version: string
  ): Promise<Record<string, Record<string, string>>> {
    const additionalOIDs = ['status', 'name', 'rxOlt', 'actualType']

    const promises = additionalOIDs.map(async (oidName) => {
      const oid = this.oidCollector.getOID(oidName)
      const altOid = this.oidCollector.getAlternativeOID(oidName)

      const data = await this.fetchWithFallback(ipAddress, port, community, version, oid, altOid, oidName)
      return [oidName, data]
    })

    const results = await Promise.all(promises)
    return Object.fromEntries(results)
  }

  /**
   * Fetch optional data with Promise.allSettled for non-blocking behavior
   */
  private async fetchOptionalData(
    ipAddress: string,
    port: number,
    community: string,
    version: string
  ): Promise<Record<string, Record<string, string>>> {
    const optionalOIDs = [
      'rx', 'tx', 'description', 'registerTime',
      'rxOnu', 'pppoe', 'zteAnPonData'
    ]

    const promises = optionalOIDs.map(async (oidName) => {
      try {
        if (oidName === 'zteAnPonData') {
          const data = await this.fetchZTEAnPonData(ipAddress, port, community, version)
          return [oidName, data]
        } else {
          const oid = this.oidCollector.getOID(oidName)
          const data = await snmpGetBulkSimple(ipAddress, port, community, version, oid, 300000)
          return [oidName, data]
        }
      } catch (error) {
        console.warn(`[ONU-DataFetcher] Failed to fetch ${oidName}:`, error)
        return [oidName, {}]
      }
    })

    const results = await Promise.allSettled(promises)
    const settledResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        console.warn(`[ONU-DataFetcher] ${optionalOIDs[index]} failed:`, result.reason)
        return [optionalOIDs[index], {}]
      }
    })

    return Object.fromEntries(settledResults)
  }

  /**
   * Fetch ZTE AN PON data with parallel processing
   */
  private async fetchZTEAnPonData(
    ipAddress: string,
    port: number,
    community: string,
    version: string
  ): Promise<Record<string, Record<string, string>>> {
    const zteOIDs = this.oidCollector.getZTEOIDs()
    const results: Record<string, Record<string, string>> = {}

    const fetchPromises = Object.entries(zteOIDs).map(async ([key, oid]) => {
      try {
        const data = await snmpGetBulkSimple(ipAddress, port, community, version, oid, 300000)
        results[key] = data
      } catch (error) {
        console.warn(`[ONU-DataFetcher] ZTE ${key} failed:`, error)
        results[key] = {}
      }
    })

    await Promise.all(fetchPromises)
    return results
  }

  /**
   * Helper function dengan fallback logic
   */
  private async fetchWithFallback(
    ipAddress: string,
    port: number,
    community: string,
    version: string,
    mainOID: string,
    altOID: string | null,
    name: string
  ): Promise<Record<string, string>> {
    try {
      const data = await snmpGetBulkSimple(ipAddress, port, community, version, mainOID, 300000)
      if (Object.keys(data).length > 0) {
        console.log(`[ONU-DataFetcher] ${name} (main): ${Object.keys(data).length} entries`)
        return data
      }
    } catch (error) {
      console.warn(`[ONU-DataFetcher] SNMP Walk failed for ${name} (main): ${error instanceof Error ? error.message : String(error)}`)
    }

    if (altOID) {
      try {
        const data = await snmpGetBulkSimple(ipAddress, port, community, version, altOID, 300000)
        console.log(`[ONU-DataFetcher] ${name} (alt): ${Object.keys(data).length} entries`)
        return data
      } catch (error) {
        console.warn(`[ONU-DataFetcher] SNMP Walk failed for ${name} (alt): ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return {}
  }

  /**
   * Check if dataset is empty
   */
  private isEmptyDataSet(data: Record<string, Record<string, string>>): boolean {
    const statusCount = Object.keys(data.statusNew || {}).length
    const serialCount = Object.keys(data.serialNumber || {}).length
    return statusCount === 0 && serialCount === 0
  }

  /**
   * Log performance metrics
   */
  private logPerformanceMetrics(
    rawData: Record<string, Record<string, string>>,
    processedData: OnuSyncData[]
  ): void {
    console.log(`[ONU-DataFetcher] Performance Summary:`)
    console.log(`  - Raw data sources: ${Object.keys(rawData).length}`)
    console.log(`  - Processed ONUs: ${processedData.length}`)

    // Data completeness metrics
    const totalOnus = processedData.length
    if (totalOnus > 0) {
      const metrics = {
        withName: processedData.filter(o => o.name && !o.name.startsWith('ONU-')).length,
        online: processedData.filter(o => o.status === 'Online').length,
        withValidSignal: processedData.filter(o => {
          const rxOlt = parseFloat(o.rxOlt?.replace(/[^\d.-]/g, '') || '0')
          const rxOnu = parseFloat(o.rxOnu?.replace(/[^\d.-]/g, '') || '0')
          return !isNaN(rxOlt) && rxOlt > -30 && !isNaN(rxOnu) && rxOnu > -30
        }).length,
        withSerial: processedData.filter(o => o.serialNumber).length,
      }

      console.log(`  - Quality metrics:`)
      console.log(`    * With Name: ${metrics.withName}/${totalOnus} (${(metrics.withName/totalOnus*100).toFixed(1)}%)`)
      console.log(`    * Online: ${metrics.online}/${totalOnus} (${(metrics.online/totalOnus*100).toFixed(1)}%)`)
      console.log(`    * Valid Signal: ${metrics.withValidSignal}/${totalOnus} (${(metrics.withValidSignal/totalOnus*100).toFixed(1)}%)`)
      console.log(`    * With Serial: ${metrics.withSerial}/${totalOnus} (${(metrics.withSerial/totalOnus*100).toFixed(1)}%)`)
    }
  }
}