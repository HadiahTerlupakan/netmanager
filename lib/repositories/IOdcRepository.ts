export interface OdcOutputData {
  idx: number
  slotName: string
  redaman?: number | null
  tubeColor: string
  coreColor: string
}

export interface OdcCreateData {
  name: string
  location?: string | null
  notes?: string | null
  latitude?: number | null
  longitude?: number | null
  otbCoreId: string
  outputs?: OdcOutputData[]
}

export interface OdcUpdateData {
  name?: string
  location?: string | null
  notes?: string | null
  latitude?: number | null
  longitude?: number | null
  otbCoreId?: string
  outputs?: OdcOutputData[]
}

export interface OdcPublic {
  id: string
  name: string
  location: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  createdAt: Date
  updatedAt: Date
  otbCoreId: string
}

export interface IOdcRepository {
  findAll(): Promise<OdcPublic[]>
  findById(id: string): Promise<OdcPublic | null>
  create(data: OdcCreateData): Promise<{ id: string }>
  update(id: string, data: OdcUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}


