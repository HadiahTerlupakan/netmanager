export interface OnuTypeCreateData {
  oltId: string
  name: string
  ethernetPorts: number
  wifi: number
  voipPorts: number
}

export interface OnuTypeUpdateData {
  name?: string
  ethernetPorts?: number
  wifi?: number
  voipPorts?: number
}

export interface OnuTypePublic {
  id: string
  oltId: string
  name: string
  ethernetPorts: number
  wifi: number
  voipPorts: number
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

