export interface OdpCreateData {
  name: string
  images?: string[]
  location?: string | null
  notes?: string | null
  keteranganJumlahKabelFeeder?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  odcOutputId?: string | null
  outputs?: OdpOutputData[]
  siteId?: string | null
}

export interface OdpUpdateData {
  name?: string
  images?: string[]
  location?: string | null
  notes?: string | null
  keteranganJumlahKabelFeeder?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  odcOutputId?: string | null
  outputs?: OdpOutputData[]
  siteId?: string | null
}

export interface OdpPublic {
  id: string
  name: string
  images: string[]
  location: string | null
  notes: string | null
  keteranganJumlahKabelFeeder: string | null
  latitude: number | null
  longitude: number | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  createdAt: Date
  updatedAt: Date
  odcOutputId: string | null
  siteId: string | null
  site?: {
    name: string
  } | null
  _count?: {
    odpOutput: number
  }
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


