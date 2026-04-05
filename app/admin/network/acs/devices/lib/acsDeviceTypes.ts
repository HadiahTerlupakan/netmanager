export interface Device {
  id: string
  serialNumber: string
  productClass: string
  manufacturer: string
  tags: string[]
  pppoe: string | null
  wanbridge: string | null
  rxpower: string | null
  temperature: string | null
  activeDevices: string | null
  ssid: string | null
  ipAddress: string | null
  lastInform: string | null
}

export interface DeviceDetail {
  _id: string
  tags: string[]
  deviceInfo: {
    productClass: string | null
    serialNumber: string | null
    manufacturer: string | null
    oui: string | null
    hardwareVersion: string | null
    softwareVersion: string | null
    upTime: string | null
    macAddress: string | null
  }
  connectionInfo: {
    lastInform: string | null
    lastBoot: string | null
    registered: string | null
  }
  virtualParameters: {
    rxPower: string | null
    temperature: string | null
    pppoeUsername: string | null
    activeDevices: string | null
    wanbridge: string | null
  }
  wifiInfo: {
    wlan1: {
      enabled: boolean | string | null
      ssid: string | null
      password: string | null
    }
    wlan5: {
      enabled: boolean | string | null
      ssid: string | null
      password: string | null
    }
  }
}
