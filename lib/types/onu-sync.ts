/**
 * Type Definitions untuk ONU Sync
 */

export type OnuSyncData = {
  oltId: string
  name: string
  description: string | null
  pppoe: string | null
  gponOnu: string
  status: string
  rxOlt: string | null
  rxOnu: string | null
  txOlt: string | null
  txOnu: string | null
  serialNumber: string | null
  actualType: string | null
  registerTime: Date | null
  distance: number | null
  lastSeen: Date | null
  registrationMode: string | null
  softwareVersion: string | null
  hardwareVersion: string | null
  temperature: number | null
  laserBiasCurrent: number | null
  vendorId: string | null
  equipmentId: string | null
  firmwareVersion: string | null
  macAddress: string | null
  batteryStatus: string | null
  opticalTransceiverType: string | null
  lastDeregTime: Date | null
  authMode: string | null
  loid: string | null
  password: string | null
  configState: string | null
  powerLevel: string | null
  dyingGaspTime: Date | null
  rxPowerStatus: string | null
  txPowerStatus: string | null
  rxBytes: bigint | null
  txBytes: bigint | null
  rxPackets: bigint | null
  txPackets: bigint | null
  rxErrors: bigint | null
  txErrors: bigint | null
  rxDrops: bigint | null
  txDrops: bigint | null
  wifiEnable: boolean | null
  wifiSsid: string | null
  wifiSecurityMode: string | null
  wifiChannel: number | null
}

export type CardPonOnu = {
  card: number
  pon: number
  onuId: string
  compositeIndex: number
  fullIndex: string
  baseIndex: number
  portName: string | null
}

export type GponPortInfo = {
  ifIndex: number
  baseIndex: number | null
}

