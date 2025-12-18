/**
 * Centralized OID management for ONU synchronization
 * Handles all SNMP OID definitions and provides alternative OIDs for fallback
 */

export class SNMPOIDCollector {
  private readonly OIDS = {
    // Critical OIDs
    statusNew: "1.3.6.1.4.1.3902.1012.3.28.2.1.4",

    // Base OIDs
    baseOid: "1.3.6.1.4.1.3902.1012.3.28.1.1",

    // Individual OIDs
    name: "1.3.6.1.4.1.3902.1012.3.28.1.1.2",
    status: "1.3.6.1.4.1.3902.1012.3.28.1.1.6",
    serialNumber: "1.3.6.1.4.1.3902.1012.3.28.1.1.5",
    registerTime: "1.3.6.1.4.1.3902.1012.3.28.1.1.12",

    // Alternative OIDs
    serialNumberAlt: "1.3.6.1.4.1.3902.1012.3.28.2.1.5",

    // RX/TX OIDs
    rxOlt: "1.3.6.1.4.1.3902.1015.1010.11.2.1.2",
    tx: "1.3.6.1.4.1.3902.1012.3.28.1.1.9",

    // RX OLT alternatives
    rxOltAlt1: "1.3.6.1.4.1.3902.1012.3.28.2.1.6",
    rxOltAlt2: "1.3.6.1.4.1.3902.1012.3.28.1.1.7",

    // RX/TX ONU
    rxOnu: "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10",
    txOnu: "1.3.6.1.4.1.3902.1012.3.50.12.1.1.11",

    // Description
    descriptionBase: "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1",
    description: "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3",

    // PPPoE
    pppoe: "1.3.6.1.4.1.3902.1082.500.20.2.17.2.1.11",

    // Actual Type
    actualType: "1.3.6.1.4.1.3902.1012.3.50.11.2.1.9",
    actualTypeAlt1: "1.3.6.1.4.1.3902.1012.3.28.2.1.8",
    actualTypeAlt2: "1.3.6.1.4.1.3902.1012.3.28.1.1.1",
  }

  private readonly ZTE_OIDS = {
    macAddress: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.5",
    vendorId: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.8",
    equipmentId: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.9",
    firmwareVersion: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.13",
    batteryStatus: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.14",
    opticalTransceiverType: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.15",
    password: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.16",
    loid: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.17",
    authMode: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.20",
    lastRegTime: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.3",
    lastDeregTime: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.4",
    softwareVersion: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.11",
    hardwareVersion: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.12",
    logicalDistance: "1.3.6.1.4.1.3902.1082.50.10.2.2.1.6",

    // Status OIDs
    configState: "1.3.6.1.4.1.3902.1082.50.10.2.3.1.2",
    powerLevel: "1.3.6.1.4.1.3902.1082.50.10.2.3.1.3",
    dyingGaspTime: "1.3.6.1.4.1.3902.1082.50.10.2.3.1.4",

    // Power Status
    rxPowerStatus: "1.3.6.1.4.1.3902.1082.50.10.2.28.1.2",
    txPowerStatus: "1.3.6.1.4.1.3902.1082.50.10.2.28.1.4",
    rxPower: "1.3.6.1.4.1.3902.1082.50.10.2.28.1.1",
    txPower: "1.3.6.1.4.1.3902.1082.50.10.2.28.1.3",

    // Performance Statistics
    rxBytes: "1.3.6.1.4.1.3902.1082.50.10.2.31.1.2",
    txBytes: "1.3.6.1.4.1.3902.1082.50.10.2.31.1.3",
    rxPackets: "1.3.6.1.4.1.3902.1082.50.10.2.31.1.4",
    txPackets: "1.3.6.1.4.1.3902.1082.50.10.2.31.1.5",
    rxErrors: "1.3.6.1.4.1.3902.1082.50.10.2.31.1.6",
    txErrors: "1.3.6.1.4.1.3902.1082.50.10.2.31.1.7",
    rxDrops: "1.3.6.1.4.1.3902.1082.50.10.2.31.1.8",
    txDrops: "1.3.6.1.4.1.3902.1082.50.10.2.31.1.9",

    // WiFi Configuration
    wifiEnable: "1.3.6.1.4.1.3902.1082.50.10.2.20.1.2",
    wifiSsid: "1.3.6.1.4.1.3902.1082.50.10.2.20.1.3",
    wifiSecurityMode: "1.3.6.1.4.1.3902.1082.50.10.2.20.1.4",
    wifiChannel: "1.3.6.1.4.1.3902.1082.50.10.2.20.1.5",
  }

  private readonly OID_ALTERNATIVES: Record<string, string | null> = {
    serialNumber: this.OIDS.serialNumberAlt,
    rxOlt: this.OIDS.rxOltAlt1,
    actualType: this.OIDS.actualTypeAlt1,
    // Add more alternatives as needed
  }

  /**
   * Get OID by name
   */
  getOID(name: string): string {
    const oid = this.OIDS[name as keyof typeof this.OIDS]
    if (!oid) {
      throw new Error(`Unknown OID name: ${name}`)
    }
    return oid
  }

  /**
   * Get alternative OID for fallback
   */
  getAlternativeOID(name: string): string | null {
    return this.OID_ALTERNATIVES[name] || null
  }

  /**
   * Get all ZTE-specific OIDs
   */
  getZTEOIDs(): Record<string, string> {
    return { ...this.ZTE_OIDS }
  }

  /**
   * Get OID with full validation and documentation
   */
  getOIDWithInfo(name: string): { oid: string; description: string; alternatives?: string[] } {
    const oid = this.getOID(name)
    const description = this.getOIDDescription(name)
    const alternatives = this.getOIDAlternatives(name)

    return {
      oid,
      description,
      alternatives: alternatives.length > 0 ? alternatives : undefined
    }
  }

  /**
   * Get human-readable description for OID
   */
  private getOIDDescription(name: string): string {
    const descriptions: Record<string, string> = {
      statusNew: "ONU Status (New Method) - 1=LOS, 3=Online, 4=DyingGasp, 6=OffLine",
      status: "ONU Status (Old Method) - 1=LOS, 3=Online, 4=DyingGasp, 6=OffLine",
      serialNumber: "ONU Serial Number (Main Method)",
      serialNumberAlt: "ONU Serial Number (Alternative Method)",
      name: "ONU Name/Description",
      rxOlt: "RX Power Level at OLT (0.001 dBm format)",
      rxOltAlt1: "RX Power Level at OLT (Alternative 1)",
      rxOltAlt2: "RX Power Level at OLT (Alternative 2)",
      tx: "TX Power Level from OLT",
      rxOnu: "RX Power Level at ONU (Formula: -30 + value*0.002 dBm)",
      txOnu: "TX Power Level from ONU (Formula: -30 + value*0.002 dBm)",
      description: "ONU Description",
      pppoe: "PPPoE Configuration",
      actualType: "Actual ONU Type/Model",
      registerTime: "ONU Registration Time",
    }

    return descriptions[name] || `OID for ${name}`
  }

  /**
   * Get all alternative OIDs for a given OID name
   */
  private getOIDAlternatives(name: string): string[] {
    const alternatives: string[] = []

    switch (name) {
      case 'serialNumber':
        alternatives.push(this.OIDS.serialNumberAlt)
        break
      case 'rxOlt':
        alternatives.push(this.OIDS.rxOltAlt1, this.OIDS.rxOltAlt2)
        break
      case 'actualType':
        alternatives.push(this.OIDS.actualTypeAlt1, this.OIDS.actualTypeAlt2)
        break
    }

    return alternatives.filter(Boolean)
  }

  /**
   * Validate OID format
   */
  validateOID(oid: string): boolean {
    // Basic OID validation - should be numbers separated by dots
    return /^\d+(\.\d+)*$/.test(oid)
  }

  /**
   * Get all available OID names
   */
  getAvailableOIDNames(): string[] {
    return Object.keys(this.OIDS)
  }

  /**
   * Get OIDs by category
   */
  getOIDsByCategory(category: 'critical' | 'important' | 'optional'): string[] {
    const categories = {
      critical: ['statusNew', 'serialNumber'],
      important: ['status', 'name', 'rxOlt', 'actualType'],
      optional: ['tx', 'rxOnu', 'description', 'registerTime', 'pppoe']
    }

    return categories[category] || []
  }
}