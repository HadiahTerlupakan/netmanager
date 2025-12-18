export interface OnuTypeCreateData {
  oltId: string
  name: string
  ethernetPorts: number
  wifi: number
  voipPorts: number
  // Detail dari show onu-type (optional)
  ponType?: string
  description?: string
  maxTcont?: number
  maxGemPort?: number
  maxSwitchPerSlot?: number
  maxFlowPerSwitch?: number
  maxIpHost?: number
  maxIpv6Host?: number
  serviceAbilityN1?: string
  serviceAbility1M?: string
  serviceAbility1P?: string
  wifiMgmtViaNonOmci?: string
  omciSendMode?: string
  defaultMulticastRange?: string
  vrg?: string
  mgcConfigureMode?: string
  maxVeip?: number
  extendedOmci?: string
  location?: string
}

export interface OnuTypeUpdateData {
  name?: string
  ethernetPorts?: number
  wifi?: number
  voipPorts?: number
  // Detail dari show onu-type (optional)
  ponType?: string
  description?: string
  maxTcont?: number
  maxGemPort?: number
  maxSwitchPerSlot?: number
  maxFlowPerSwitch?: number
  maxIpHost?: number
  maxIpv6Host?: number
  serviceAbilityN1?: string
  serviceAbility1M?: string
  serviceAbility1P?: string
  wifiMgmtViaNonOmci?: string
  omciSendMode?: string
  defaultMulticastRange?: string
  vrg?: string
  mgcConfigureMode?: string
  maxVeip?: number
  extendedOmci?: string
  location?: string
}

export interface OnuTypePublic {
  id: string
  oltId: string
  name: string
  ethernetPorts: number
  wifi: number
  voipPorts: number
  // Detail dari show onu-type (optional)
  ponType?: string | null
  description?: string | null
  maxTcont?: number | null
  maxGemPort?: number | null
  maxSwitchPerSlot?: number | null
  maxFlowPerSwitch?: number | null
  maxIpHost?: number | null
  maxIpv6Host?: number | null
  serviceAbilityN1?: string | null
  serviceAbility1M?: string | null
  serviceAbility1P?: string | null
  wifiMgmtViaNonOmci?: string | null
  omciSendMode?: string | null
  defaultMulticastRange?: string | null
  vrg?: string | null
  mgcConfigureMode?: string | null
  maxVeip?: number | null
  extendedOmci?: string | null
  location?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface IOnuTypeRepository {
  findAll(): Promise<OnuTypePublic[]>
  findByOltId(oltId: string): Promise<OnuTypePublic[]>
  findById(id: string): Promise<OnuTypePublic | null>
  create(data: OnuTypeCreateData): Promise<{ id: string }>
  update(id: string, data: OnuTypeUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}

