import type { OnuSyncData } from '@/lib/types/onu-sync'

export class PerformanceOptimizer {
  /**
   * Apply performance optimizations to ONU data
   */
  optimizeData(onuData: OnuSyncData[]): OnuSyncData[] {
    if (onuData.length === 0) return onuData

    console.log(`[Performance-Optimizer] Optimizing ${onuData.length} ONUs...`)

    // Step 1: Remove duplicates based on gponOnu
    const deduplicatedOnus = this.removeDuplicates(onuData)

    // Step 2: Optimize data types and memory usage
    const optimizedOnus = this.optimizeDataTypes(deduplicatedOnus)

    // Step 3: Apply data validation and cleanup
    const validatedOnus = this.validateAndCleanData(optimizedOnus)

    // Step 4: Sort for consistent ordering
    const sortedOnus = this.sortData(validatedOnus)

    console.log(`[Performance-Optimizer] Optimization complete: ${onuData.length} -> ${sortedOnus.length} ONUs`)

    return sortedOnus
  }

  /**
   * Remove duplicate ONU entries based on gponOnu identifier
   */
  private removeDuplicates(onuData: OnuSyncData[]): OnuSyncData[] {
    const seen = new Set<string>()
    const deduplicated: OnuSyncData[] = []

    for (const onu of onuData) {
      if (!seen.has(onu.gponOnu)) {
        seen.add(onu.gponOnu)
        deduplicated.push(onu)
      } else {
        console.log(`[Performance-Optimizer] Removed duplicate ONU: ${onu.gponOnu}`)
      }
    }

    return deduplicated
  }

  /**
   * Optimize data types and reduce memory footprint
   */
  private optimizeDataTypes(onuData: OnuSyncData[]): OnuSyncData[] {
    return onuData.map(onu => ({
      ...onu,

      // Optimize string fields
      name: this.optimizeString(onu.name),
      description: this.optimizeString(onu.description),
      pppoe: this.optimizeString(onu.pppoe),
      status: this.optimizeStatus(onu.status),
      rxOlt: this.optimizePowerLevel(onu.rxOlt),
      rxOnu: this.optimizePowerLevel(onu.rxOnu),
      txOlt: this.optimizePowerLevel(onu.txOlt),
      txOnu: this.optimizePowerLevel(onu.txOnu),
      serialNumber: this.optimizeString(onu.serialNumber),
      actualType: this.optimizeString(onu.actualType),

      // Optimize optional fields
      vendorId: this.optimizeString(onu.vendorId),
      equipmentId: this.optimizeString(onu.equipmentId),
      firmwareVersion: this.optimizeString(onu.firmwareVersion),
      macAddress: this.optimizeMacAddress(onu.macAddress),
      softwareVersion: this.optimizeString(onu.softwareVersion),
      hardwareVersion: this.optimizeString(onu.hardwareVersion),

      // Optimize number fields
      distance: this.optimizeDistance(onu.distance),

      // Keep dates as is, but ensure they're valid
      registerTime: this.validateDate(onu.registerTime),
      lastSeen: this.validateDate(onu.lastSeen),
      lastDeregTime: this.validateDate(onu.lastDeregTime),
      dyingGaspTime: this.validateDate(onu.dyingGaspTime),

      // Optimize boolean fields
      wifiEnable: this.optimizeBoolean(onu.wifiEnable),
    }))
  }

  /**
   * Validate and clean data
   */
  private validateAndCleanData(onuData: OnuSyncData[]): OnuSyncData[] {
    return onuData.map(onu => {
      // Validate ONU identifier
      if (!onu.gponOnu || onu.gponOnu.trim().length === 0) {
        console.warn(`[Performance-Optimizer] Invalid GPON ONU identifier, skipping:`, onu)
        return null
      }

      // Validate status consistency
      const validatedOnu = { ...onu }

      // If status is Online but no signal data, try to infer
      if (onu.status === 'Online' && onu.rxOlt === 'N/A') {
        const rxOltNum = this.extractPowerLevel(onu.rxOlt)
        if (rxOltNum !== null && rxOltNum > -30) {
          validatedOnu.status = 'Online'
        } else {
          validatedOnu.status = 'Unknown'
        }
      }

      // If no name, generate one
      if (!onu.name || onu.name.startsWith('ONU-')) {
        const parts = onu.gponOnu.split(':')
        if (parts.length === 2) {
          validatedOnu.name = `ONU-${parts[1]}`
        }
      }

      // Validate power levels are in reasonable range
      validatedOnu.rxOlt = this.validatePowerLevel(onu.rxOlt)
      validatedOnu.rxOnu = this.validatePowerLevel(onu.rxOnu)
      validatedOnu.txOlt = this.validatePowerLevel(onu.txOlt)
      validatedOnu.txOnu = this.validatePowerLevel(onu.txOnu)

      return validatedOnu
    }).filter((onu): onu is OnuSyncData => onu !== null)
  }

  /**
   * Sort data for consistent ordering
   */
  private sortData(onuData: OnuSyncData[]): OnuSyncData[] {
    return onuData.sort((a, b) => {
      // Sort by gponOnu (card/port:onuId)
      const aMatch = a.gponOnu.match(/(\\d+)\\/(\\d+):(\\d+)/)
      const bMatch = b.gponOnu.match(/(\\d+)\\/(\\d+):(\\d+)/)

      if (aMatch && bMatch) {
        const [, aCard, aPort, aOnuId] = aMatch.map(Number)
        const [, bCard, bPort, bOnuId] = bMatch.map(Number)

        // Sort by card, then port, then ONU ID
        if (aCard !== bCard) return aCard - bCard
        if (aPort !== bPort) return aPort - bPort
        return aOnuId - bOnuId
      }

      // Fallback to string comparison
      return a.gponOnu.localeCompare(b.gponOnu)
    })
  }

  // Helper methods for optimization
  private optimizeString(value?: string | null): string | null {
    if (!value) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  private optimizeStatus(status: string): string {
    const validStatuses = ['Online', 'Offline', 'LOS', 'DyingGasp', 'OffLine', 'Unknown']
    return validStatuses.includes(status) ? status : 'Unknown'
  }

  private optimizePowerLevel(value?: string | null): string | null {
    if (!value || value === 'N/A') return null

    // Try to extract numeric value
    const match = value.match(/(-?\\d+\\.?\\d*)/)
    if (match) {
      const num = parseFloat(match[1])
      if (!isNaN(num)) {
        // Validate range (-50 to +10 dBm is reasonable for fiber optics)
        if (num >= -50 && num <= 10) {
          return `${num.toFixed(3)} dBm`
        }
      }
    }

    return null
  }

  private validatePowerLevel(value?: string | null): string | null {
    if (!value) return null
    if (value === 'N/A') return value

    const optimized = this.optimizePowerLevel(value)
    return optimized || 'N/A'
  }

  private extractPowerLevel(value?: string | null): number | null {
    if (!value || value === 'N/A') return null

    const match = value.match(/(-?\\d+\\.?\\d*)/)
    if (match) {
      const num = parseFloat(match[1])
      return !isNaN(num) ? num : null
    }

    return null
  }

  private optimizeMacAddress(mac?: string | null): string | null {
    if (!mac) return null

    const cleaned = mac.trim().replace(/[^0-9A-Fa-f]/g, '')
    if (cleaned.length === 12 && /^[0-9A-Fa-f]+$/.test(cleaned)) {
      return cleaned.match(/.{2}/g)?.join(':').toUpperCase()
    }

    return null
  }

  private optimizeDistance(distance?: number | null): number | null {
    if (distance === null || distance === undefined) return null
    // Validate distance range (0.1 to 50 km is reasonable for GPON)
    return distance >= 0.1 && distance <= 50 ? distance : null
  }

  private optimizeBoolean(value?: boolean | null): boolean | null {
    return value === null ? null : Boolean(value)
  }

  private validateDate(date?: Date | null): Date | null {
    if (!date) return null

    // Check if date is reasonable (not too old or too far in future)
    const now = new Date()
    const minDate = new Date(now.getFullYear() - 5, 0, 1) // 5 years ago
    const maxDate = new Date(now.getFullYear() + 1, 11, 31) // 1 year from now

    if (date >= minDate && date <= maxDate) {
      return date
    }

    return null
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(original: OnuSyncData[], optimized: OnuSyncData[]): {
    totalOriginal: number
    totalOptimized: number
    duplicatesRemoved: number
    invalidRemoved: number
    dataQualityScore: number
  } {
    const duplicatesRemoved = original.length - optimized.length
    const totalOriginal = original.length
    const totalOptimized = optimized.length

    // Calculate data quality score
    const withName = optimized.filter(o => o.name && !o.name.startsWith('ONU-')).length
    const withStatus = optimized.filter(o => o.status !== 'Unknown').length
    const withSignal = optimized.filter(o => o.rxOlt && o.rxOlt !== 'N/A').length
    const withSerial = optimized.filter(o => o.serialNumber).length

    const dataQualityScore = totalOptimized > 0
      ? ((withName + withStatus + withSignal + withSerial) / (totalOptimized * 4)) * 100
      : 0

    return {
      totalOriginal,
      totalOptimized,
      duplicatesRemoved,
      invalidRemoved: 0, // Would be calculated during validation if needed
      dataQualityScore: Math.round(dataQualityScore * 10) / 10
    }
  }
}