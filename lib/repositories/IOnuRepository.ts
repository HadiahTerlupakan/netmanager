export interface OnuPublic {
  id: string
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
  lastUpdate: Date
  createdAt: Date
  updatedAt: Date
}

export interface OnuCreateData {
  oltId: string
  name: string
  description?: string | null
  pppoe?: string | null
  gponOnu: string
  status: string
  rxOlt?: string | null
  rxOnu?: string | null
  serialNumber?: string | null
  actualType?: string | null
}

export interface OnuUpdateData {
  name?: string
  description?: string | null
  pppoe?: string | null
  status?: string
  rxOlt?: string | null
  rxOnu?: string | null
  serialNumber?: string | null
  actualType?: string | null
  lastUpdate?: Date
}

export interface IOnuRepository {
  findAll(): Promise<OnuPublic[]>
  findByOltId(oltId: string): Promise<OnuPublic[]>
  findByGponOnu(oltId: string, gponOnu: string): Promise<OnuPublic | null>
  create(data: OnuCreateData): Promise<{ id: string }>
  upsert(oltId: string, gponOnu: string, data: OnuCreateData): Promise<{ id: string }>
  update(id: string, data: OnuUpdateData): Promise<void>
  delete(id: string): Promise<void>
  deleteByOltId(oltId: string): Promise<void>
  count(): Promise<number>
  countByOltId(oltId: string): Promise<number>
  countByStatus(status: string): Promise<number>
}

