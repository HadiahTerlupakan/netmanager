export interface OdpCreateData {
  name: string
  location?: string | null
  notes?: string | null
  keteranganJumlahKabelFeeder?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  odcOutputId: string
  outputs?: OdpOutputData[]
  siteId?: string | null
}

export interface OdpUpdateData {
  name?: string
  location?: string | null
  notes?: string | null
  keteranganJumlahKabelFeeder?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  odcOutputId?: string
  outputs?: OdpOutputData[]
  siteId?: string | null
}

export interface OdpPublic {
  id: string
  name: string
  location: string | null
  notes: string | null
  keteranganJumlahKabelFeeder: string | null
  latitude: number | null
  longitude: number | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  createdAt: Date
  updatedAt: Date
  odcOutputId: string
  siteId: string | null
}

export interface OdpOutputData {
  idx: number
  slotName: string
  redaman?: number | null
  tubeColor: string
  coreColor: string
}

export interface IOdpRepository {
  findAll(siteId?: string): Promise<OdpPublic[]>
  findById(id: string): Promise<OdpPublic | null>
  create(data: OdpCreateData): Promise<{ id: string }>
  update(id: string, data: OdpUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}


