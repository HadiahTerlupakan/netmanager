export interface OdpCreateData {
  name: string
  location?: string | null
  notes?: string | null
  latitude?: number | null
  longitude?: number | null
  odcOutputId: string
  outputs?: OdpOutputData[]
}

export interface OdpUpdateData {
  name?: string
  location?: string | null
  notes?: string | null
  latitude?: number | null
  longitude?: number | null
  odcOutputId?: string
  outputs?: OdpOutputData[]
}

export interface OdpPublic {
  id: string
  name: string
  location: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  createdAt: Date
  updatedAt: Date
  odcOutputId: string
}

export interface OdpOutputData {
  idx: number
  slotName: string
  redaman?: number | null
  tubeColor: string
  coreColor: string
}

export interface IOdpRepository {
  findAll(): Promise<OdpPublic[]>
  findById(id: string): Promise<OdpPublic | null>
  create(data: OdpCreateData): Promise<{ id: string }>
  update(id: string, data: OdpUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}


