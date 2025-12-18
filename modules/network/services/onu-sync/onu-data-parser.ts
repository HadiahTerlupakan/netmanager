import type { OnuSyncData } from '@/lib/types/onu-sync'

export interface ParsedSNMPData {
  statusNew: Record<string, string>
  status: Record<string, string>
  name: Record<string, string>
  serialNumber: Record<string, string>
  rxOlt: Record<string, string>
  rxOnu: Record<string, string>
  tx: Record<string, string>
  description: Record<string, string>
  registerTime: Record<string, string>
  pppoe: Record<string, string>
  actualType: Record<string, string>
  zteAnPonData: Record<string, Record<string, string>>
}

export interface ParseONUDataRequest {
  rawData: Record<string, Record<string, string>>
  gponPortMap: Map<string, { ifIndex: number; baseIndex: number | null }>
  oltId: string
  maxResults?: number
}

export class ONUDataParser {
  /**
   * Parse raw SNMP data into structured ONU data
   */
  async parseONUData(request: ParseONUDataRequest): Promise<OnuSyncData[]> {
    const { rawData, gponPortMap, oltId, maxResults } = request

    console.log(`[ONU-DataParser] Parsing ${this.getTotalDataEntries(rawData as unknown as ParsedSNMPData)} data entries...`)

    // Step 1: Extract and validate indexes
    const onuIndexes = this.extractOnuIndexes(rawData as unknown as ParsedSNMPData)
    if (onuIndexes.length === 0) {
      console.log(`[ONU-DataParser] No ONU indexes found`)
      return []
    }

    console.log(`[ONU-DataParser] Found ${onuIndexes.length} unique ONU indexes`)

    // Step 2: Group ONUs by card/PON
    const onuGroups = this.groupOnusByCardPON(onuIndexes, gponPortMap)

    // Step 3: Parse each ONU group
    const onus: OnuSyncData[] = []
    for (const [key, onuList] of onuGroups) {
      console.log(`[ONU-DataParser] Processing group ${key}: ${onuList.length} ONUs`)
      const groupOnus = await this.parseOnuGroup(onuList, rawData as unknown as ParsedSNMPData, oltId)
      onus.push(...groupOnus)
    }

    // Step 4: Apply maxResults if specified
    if (maxResults && maxResults > 0) {
      const limitedOnus = onus.slice(0, maxResults)
      console.log(`[ONU-DataParser] Applied maxResults limit: ${limitedOnus.length}/${onus.length}`)
      return limitedOnus
    }

    return onus
  }

  /**
   * Extract unique ONU indexes from all data sources
   */
  private extractOnuIndexes(rawData: ParsedSNMPData): string[] {
    const allIndexes = new Set<string>()

    // Priority order: statusNew > status > name > serialNumber
    const dataSources = [
      { name: 'statusNew', data: rawData.statusNew },
      { name: 'status', data: rawData.status },
      { name: 'name', data: rawData.name },
      { name: 'serialNumber', data: rawData.serialNumber },
    ]

    for (const source of dataSources) {
      if (source.data && Object.keys(source.data).length > 0) {
        Object.keys(source.data).forEach(index => allIndexes.add(index))
        console.log(`[ONU-DataParser] Found ${Object.keys(source.data).length} indexes from ${source.name}`)
      }
    }

    return Array.from(allIndexes)
  }

  /**
   * Group ONUs by Card/PON for systematic processing
   */
  private groupOnusByCardPON(
    onuIndexes: string[],
    gponPortMap: Map<string, { ifIndex: number; baseIndex: number | null }>
  ): Map<string, Array<{ fullIndex: string; onuId: string; card: number; pon: number }>> {
    const groups = new Map<string, Array<{ fullIndex: string; onuId: string; card: number; pon: number }>>()

    // Build base index to port map for fast lookup
    const baseIndexToPortMap = new Map<number, string>()
    for (const [portName, portInfo] of gponPortMap.entries()) {
      if (portInfo.baseIndex !== null) {
        baseIndexToPortMap.set(portInfo.baseIndex, portName)
      }
    }

    for (const index of onuIndexes) {
      const parsed = this.parseOnuIndex(index, baseIndexToPortMap, gponPortMap)
      if (parsed) {
        const key = `${parsed.card}-${parsed.pon}`
        if (!groups.has(key)) {
          groups.set(key, [])
        }
        groups.get(key)!.push({
          fullIndex: index,
          onuId: parsed.onuId,
          card: parsed.card,
          pon: parsed.pon
        })
      }
    }

    return groups
  }

  /**
   * Parse individual ONU index to extract card, port, and onuId
   */
  private parseOnuIndex(
    index: string,
    baseIndexToPortMap: Map<number, string>,
    gponPortMap: Map<string, { ifIndex: number; baseIndex: number | null }>
  ): { card: number; pon: number; onuId: string } | null {
    const parts = index.split('.')
    if (parts.length < 2) return null

    const baseIndex = parseInt(parts[0], 10)
    const onuId = parts[1]

    if (isNaN(baseIndex) || !onuId) return null

    // Try to match using base index map first
    const matchedPort = baseIndexToPortMap.get(baseIndex)
    if (matchedPort) {
      const portMatch = matchedPort.match(/^gpon_(\d+)\/(\d+)\/(\d+)$/i)
      if (portMatch) {
        return {
          card: parseInt(portMatch[2], 10),
          pon: parseInt(portMatch[3], 10),
          onuId
        }
      }
    }

    // Fallback: parse as composite index
    const compositeIndex = baseIndex
    const type = (compositeIndex >> 28) & 0xF
    const slot = (compositeIndex >> 16) & 0xFF
    const port = (compositeIndex >> 8) & 0xFF

    if (type === 1 && slot > 0 && port > 0) {
      return {
        card: slot,
        pon: port,
        onuId
      }
    }

    return null
  }

  /**
   * Parse a group of ONUs for a specific Card/PON
   */
  private async parseOnuGroup(
    onuList: Array<{ fullIndex: string; onuId: string; card: number; pon: number }>,
    rawData: ParsedSNMPData,
    oltId: string
  ): Promise<OnuSyncData[]> {
    const onus: OnuSyncData[] = []

    // Sort by ONU ID for consistent processing
    onuList.sort((a, b) => parseInt(a.onuId, 10) - parseInt(b.onuId, 10))

    for (const onuInfo of onuList) {
      const onuData = await this.parseIndividualONU(onuInfo, rawData, oltId)
      if (onuData) {
        onus.push(onuData)
      }
    }

    return onus
  }

  /**
   * Parse individual ONU data
   */
  private async parseIndividualONU(
    onuInfo: { fullIndex: string; onuId: string; card: number; pon: number },
    rawData: ParsedSNMPData,
    oltId: string
  ): Promise<OnuSyncData | null> {
    const { fullIndex: idx, onuId, card, pon } = onuInfo

    try {
      // Extract data for this ONU from all sources
      const statusData = this.extractONUDataWithFallback(idx, rawData, ['statusNew', 'status'])
      const nameData = this.extractONUDataWithFallback(idx, rawData, ['name'])
      const serialData = this.extractONUDataWithFallback(idx, rawData, ['serialNumber'])
      const rxOltData = this.extractONUDataWithFallback(idx, rawData, ['rxOlt'])
      const rxOnuData = this.extractONUDataWithFallback(idx, rawData, ['rxOnu'])
      const txData = this.extractONUDataWithFallback(idx, rawData, ['tx'])
      const descData = this.extractONUDataWithFallback(idx, rawData, ['description'])
      const regData = this.extractONUDataWithFallback(idx, rawData, ['registerTime'])
      const pppoeData = this.extractONUDataWithFallback(idx, rawData, ['pppoe'])
      const typeData = this.extractONUDataWithFallback(idx, rawData, ['actualType'])

      // Parse individual fields
      const status = this.parseStatus(statusData.primary, statusData.fallback)
      const name = this.parseName(nameData.primary || nameData.fallback)
      const serialNumber = this.parseSerialNumber(serialData.primary || serialData.fallback)
      const rxOlt = this.parseRxOlt(rxOltData.primary || rxOltData.fallback, txData.primary || txData.fallback)
      const rxOnu = this.parseRxOnu(rxOnuData.primary || rxOnuData.fallback)
      const txOlt = this.parseTxOlt(txData.primary || txData.fallback)
      const txOnu = "N/A" // Not available in standard SNMP fetch
      const description = this.parseDescription(descData.primary || descData.fallback)
      const registerTime = this.parseRegisterTime(regData.primary || regData.fallback)
      const pppoe = this.parsePPPoE(pppoeData.primary || pppoeData.fallback)
      const actualType = this.parseActualType(typeData.primary || typeData.fallback)

      // Extract ZTE-specific data
      const zteData = this.extractZTEData(idx, rawData.zteAnPonData)

      // Generate GPON ONU identifier
      const gponOnu = `${card}/${pon}:${onuId}`

      return {
        oltId,
        name,
        description,
        pppoe,
        gponOnu,
        status,
        rxOlt,
        rxOnu,
        txOlt,
        txOnu,
        serialNumber,
        actualType,
        registerTime,
        distance: zteData.distance,
        lastSeen: new Date(),
        registrationMode: zteData.registrationMode,
        softwareVersion: zteData.softwareVersion,
        hardwareVersion: zteData.hardwareVersion,
        temperature: zteData.temperature,
        laserBiasCurrent: zteData.laserBiasCurrent,
        vendorId: zteData.vendorId,
        equipmentId: zteData.equipmentId,
        firmwareVersion: zteData.firmwareVersion,
        macAddress: zteData.macAddress,
        batteryStatus: zteData.batteryStatus,
        opticalTransceiverType: zteData.opticalTransceiverType,
        lastDeregTime: zteData.lastDeregTime,
        authMode: zteData.authMode,
        loid: zteData.loid,
        password: zteData.password,
        configState: zteData.configState,
        powerLevel: zteData.powerLevel,
        dyingGaspTime: zteData.dyingGaspTime,
        rxPowerStatus: zteData.rxPowerStatus,
        txPowerStatus: zteData.txPowerStatus,
        rxBytes: zteData.rxBytes,
        txBytes: zteData.txBytes,
        rxPackets: zteData.rxPackets,
        txPackets: zteData.txPackets,
        rxErrors: zteData.rxErrors,
        txErrors: zteData.txErrors,
        rxDrops: zteData.rxDrops,
        txDrops: zteData.txDrops,
        wifiEnable: zteData.wifiEnable,
        wifiSsid: zteData.wifiSsid,
        wifiSecurityMode: zteData.wifiSecurityMode,
        wifiChannel: zteData.wifiChannel,
      }
    } catch (error) {
      console.error(`[ONU-DataParser] Error parsing ONU ${idx}:`, error)
      return null
    }
  }

  /**
   * Extract ONU data with multiple source fallback
   */
  private extractONUDataWithFallback(
    index: string,
    rawData: ParsedSNMPData,
    sourceNames: (keyof ParsedSNMPData)[]
  ): { primary: string | undefined; fallback: string | undefined } {
    let primary: string | undefined
    let fallback: string | undefined

    for (const sourceName of sourceNames) {
      const source = rawData[sourceName] as Record<string, string>
      if (source && index in source) {
        if (!primary) {
          primary = source[index]
        } else if (!fallback) {
          fallback = source[index]
          break
        }
      }
    }

    // Try alternative formats (.1 suffix)
    if (!primary && sourceNames.length > 0) {
      const source = rawData[sourceNames[0]] as Record<string, string>
      if (source) {
        const indexWithOne = `${index}.1`
        if (indexWithOne in source) {
          primary = source[indexWithOne]
        }
      }
    }

    return { primary, fallback }
  }

  /**
   * Extract ZTE-specific data for ONU
   */
  private extractZTEData(
    index: string,
    zteData: Record<string, Record<string, string>>
  ): any {
    const getZteValue = (key: string): string | null => {
      const data = zteData[key]
      if (!data) return null

      // Try exact match first
      let value = data[index] || null
      if (!value) {
        // Try with .1 suffix
        value = data[`${index}.1`] || null
      }
      if (!value) {
        // Try matching by onu_id
        const indexParts = index.split('.')
        if (indexParts.length >= 2) {
          const onuId = indexParts[1]
          const matchingKeys = Object.keys(data).filter(k => {
            const parts = k.split('.')
            return parts.length >= 2 && (parts[parts.length - 1] === onuId || parts[parts.length - 2] === onuId)
          })
          if (matchingKeys.length > 0) {
            value = data[matchingKeys[0]] || null
          }
        }
      }
      return value
    }

    // Parse BigInt values safely
    const parseBigInt = (value: string | null): bigint | null => {
      if (!value) return null
      try {
        const num = BigInt(value)
        return num > 0n ? num : null
      } catch {
        return null
      }
    }

    return {
      macAddress: this.cleanMacAddress(getZteValue('macAddress')),
      vendorId: getZteValue('vendorId')?.trim() || null,
      equipmentId: getZteValue('equipmentId')?.trim() || null,
      firmwareVersion: getZteValue('firmwareVersion')?.trim() || null,
      batteryStatus: getZteValue('batteryStatus')?.trim() || null,
      opticalTransceiverType: getZteValue('opticalTransceiverType')?.trim() || null,
      password: getZteValue('password')?.trim() || null,
      loid: getZteValue('loid')?.trim() || null,
      authMode: getZteValue('authMode')?.trim() || null,
      softwareVersion: getZteValue('softwareVersion')?.trim() || null,
      hardwareVersion: getZteValue('hardwareVersion')?.trim() || null,
      configState: getZteValue('configState')?.trim() || null,
      powerLevel: getZteValue('powerLevel')?.trim() || null,
      rxPowerStatus: getZteValue('rxPowerStatus')?.trim() || null,
      txPowerStatus: getZteValue('txPowerStatus')?.trim() || null,
      distance: this.parseDistance(getZteValue('logicalDistance')),
      lastRegTime: this.parseTimestamp(getZteValue('lastRegTime')),
      lastDeregTime: this.parseTimestamp(getZteValue('lastDeregTime')),
      dyingGaspTime: this.parseTimestamp(getZteValue('dyingGaspTime')),
      rxBytes: parseBigInt(getZteValue('rxBytes')),
      txBytes: parseBigInt(getZteValue('txBytes')),
      rxPackets: parseBigInt(getZteValue('rxPackets')),
      txPackets: parseBigInt(getZteValue('txPackets')),
      rxErrors: parseBigInt(getZteValue('rxErrors')),
      txErrors: parseBigInt(getZteValue('txErrors')),
      rxDrops: parseBigInt(getZteValue('rxDrops')),
      txDrops: parseBigInt(getZteValue('txDrops')),
      wifiEnable: this.parseBoolean(getZteValue('wifiEnable')),
      wifiSsid: getZteValue('wifiSsid')?.trim() || null,
      wifiSecurityMode: getZteValue('wifiSecurityMode')?.trim() || null,
      wifiChannel: this.parseInt(getZteValue('wifiChannel')),
      temperature: null, // TODO: Add temperature parsing if OID available
      laserBiasCurrent: null, // TODO: Add laser bias current parsing if OID available
      registrationMode: null, // TODO: Add registration mode parsing if OID available
    }
  }

  // Individual field parsing methods
  private parseStatus(primary?: string, fallback?: string): string {
    const statusValue = primary || fallback
    if (!statusValue) return 'Unknown'

    const statusNum = parseInt(statusValue, 10)
    if (isNaN(statusNum)) return 'Unknown'

    // Status interpretation: 1=LOS, 3=Online, 4=DyingGasp, 6=OffLine
    switch (statusNum) {
      case 1: return 'LOS'
      case 3: return 'Online'
      case 4: return 'DyingGasp'
      case 6: return 'OffLine'
      default:
        console.log(`[ONU-DataParser] Unknown status value: ${statusNum}`)
        return 'Unknown'
    }
  }

  private parseName(value?: string): string {
    if (!value) return `ONU-${Date.now()}`

    const cleaned = value.trim()

    // Convert hex string if needed
    if (/^[0-9A-Fa-f]{1,2}(\\s+[0-9A-Fa-f]{1,2})+$/.test(cleaned)) {
      const converted = this.convertHexStringToAscii(cleaned)
      if (converted && converted.length >= 3) {
        return converted
      }
    }

    // Validate name
    if (cleaned.length >= 3 && !this.isTimestamp(cleaned)) {
      return cleaned
    }

    return `ONU-${Date.now()}`
  }

  private parseSerialNumber(value?: string): string | null {
    if (!value) return null

    const cleaned = value.trim()

    // Handle Hex-STRING format
    if (cleaned.includes('Hex-STRING:') || /^[0-9A-Fa-f\\s]+$/.test(cleaned)) {
      const converted = this.convertHexToSerialNumber(cleaned)
      if (converted && converted.length > 0) {
        return converted
      }
    }

    // Filter out timestamps and empty values
    if (this.isTimestamp(cleaned) || cleaned.length === 0) {
      return null
    }

    return cleaned
  }

  private parseRxOlt(primary?: string, fallback?: string): string {
    const value = primary || fallback
    if (!value) return "N/A"

    const rxOltNum = parseInt(value, 10)
    if (isNaN(rxOltNum)) return "N/A"

    // Handle special values
    if (rxOltNum <= -80000 || rxOltNum === 0 || rxOltNum === 65535) {
      return "N/A"
    }

    // Convert from 0.001 dBm format
    return `${(rxOltNum / 1000).toFixed(3)} dBm`
  }

  private parseRxOnu(value?: string): string {
    if (!value) return "N/A"

    const rxOnuNum = parseInt(value, 10)
    if (isNaN(rxOnuNum)) return "N/A"

    if (rxOnuNum === 0 || rxOnuNum === 65535) {
      return "N/A"
    }

    // Convert using formula: dBm = -30 + (value * 0.002)
    const dbmValue = -30 + (rxOnuNum * 0.002)
    return `${dbmValue.toFixed(3)} dBm`
  }

  private parseTxOlt(value?: string): string {
    if (!value) return "N/A"

    const txNum = parseFloat(value)
    if (isNaN(txNum)) return "N/A"

    if (Math.abs(txNum) > 1000) {
      return `${(txNum / 100).toFixed(2)} dBm`
    } else if (txNum === 0 || Math.abs(txNum) > 100) {
      return "N/A"
    } else {
      return `${txNum.toFixed(2)} dBm`
    }
  }

  private parseDescription(value?: string): string | null {
    if (!value) return null

    const cleaned = value.trim()

    // Convert hex string if needed
    if (/^[0-9A-Fa-f]{1,2}(\\s+[0-9A-Fa-f]{1,2})+$/.test(cleaned)) {
      const converted = this.convertHexStringToAscii(cleaned)
      if (converted && converted.length > 0) {
        return converted
      }
    }

    return cleaned.length > 0 ? cleaned : null
  }

  private parseRegisterTime(value?: string): Date | null {
    if (!value) return null

    try {
      const regNum = parseInt(value, 10)
      if (!isNaN(regNum) && regNum > 1000000000) {
        return new Date(regNum * 1000) // Convert seconds to milliseconds
      }
    } catch {
      // Ignore parse errors
    }

    return null
  }

  private parsePPPoE(value?: string): string | null {
    if (!value) return null

    const cleaned = value.trim()

    // Convert hex string if needed
    if (/^[0-9A-Fa-f]{1,2}(\\s+[0-9A-Fa-f]{1,2})+$/.test(cleaned)) {
      const converted = this.convertHexStringToAscii(cleaned)
      if (converted && converted.length > 0) {
        return converted
      }
    }

    return cleaned.length > 0 ? cleaned : null
  }

  private parseActualType(value?: string): string | null {
    if (!value) return null

    const cleaned = value.trim()

    // Convert hex string if needed
    if (/^[0-9A-Fa-f]{1,2}(\\s+[0-9A-Fa-f]{1,2})+$/.test(cleaned)) {
      const converted = this.convertHexStringToAscii(cleaned)
      if (converted && converted.length > 0) {
        return converted
      }
    }

    return cleaned.length > 0 ? cleaned : null
  }

  // Helper methods
  private convertHexStringToAscii(hexString: string): string | null {
    try {
      const hexBytes = hexString.trim().split(/\\s+/).filter(b => b.length > 0)
      if (hexBytes.length === 0) return null

      let asciiStr = ''
      for (const hexByte of hexBytes) {
        const decimal = parseInt(hexByte, 16)
        if (!isNaN(decimal) && decimal >= 0 && decimal <= 255) {
          asciiStr += String.fromCharCode(decimal)
        } else {
          return null
        }
      }

      return asciiStr
    } catch {
      return null
    }
  }

  private convertHexToSerialNumber(hexString: string): string | null {
    try {
      let cleanHex = hexString.trim()
      if (cleanHex.toLowerCase().includes('hex-string:')) {
        cleanHex = cleanHex.split(':').slice(1).join(':').trim()
      }

      const hexBytes = cleanHex.split(/\\s+/).filter(b => b.length > 0)
      if (hexBytes.length < 8) return null

      // First 4 bytes to ASCII
      let asciiPart = ''
      for (let i = 0; i < 4; i++) {
        const decimal = parseInt(hexBytes[i], 16)
        if (decimal >= 32 && decimal <= 126) {
          asciiPart += String.fromCharCode(decimal)
        } else {
          return null
        }
      }

      // Last 4 bytes to hex string
      const hexPart = hexBytes.slice(4, 8).map(b => b.toUpperCase()).join('')

      return asciiPart + hexPart
    } catch {
      return null
    }
  }

  private isTimestamp(str: string): boolean {
    return /^\\d{4}-\\d{2}-\\d{2}(\\s+\\d{2}:\\d{2}:\\d{2})?$/.test(str.trim())
  }

  private cleanMacAddress(mac?: string | null): string | null {
    if (!mac) return null

    const cleaned = mac.trim().replace(/[^0-9A-Fa-f]/g, '')
    if (cleaned.length === 12 && /^[0-9A-Fa-f]+$/.test(cleaned)) {
      return cleaned.match(/.{2}/g)?.join(':').toUpperCase() || cleaned
    }

    return null
  }

  private parseDistance(value?: string | null): number | null {
    if (!value) return null
    const distNum = parseFloat(value)
    return !isNaN(distNum) && distNum > 0 ? distNum / 1000 : null // Convert to km
  }

  private parseTimestamp(value?: string | null): Date | null {
    if (!value) return null
    try {
      const num = parseInt(value, 10)
      if (!isNaN(num) && num > 1000000000) {
        return new Date(num * 1000)
      }
    } catch {
      // Ignore
    }
    return null
  }

  private parseBoolean(value?: string | null): boolean | null {
    if (!value) return null
    const lower = value.toLowerCase()
    return lower === '1' || lower === 'true' || lower === 'enable'
  }

  private parseInt(value?: string | null): number | null {
    if (!value) return null
    const num = parseInt(value, 10)
    return !isNaN(num) ? num : null
  }

  private getTotalDataEntries(rawData: ParsedSNMPData): number {
    return Object.values(rawData).reduce((total, data) => {
      return total + (data ? Object.keys(data).length : 0)
    }, 0)
  }
}