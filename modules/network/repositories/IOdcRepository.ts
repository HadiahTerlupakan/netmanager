export interface OdcOutputData {
  idx: number
  slotName: string
  redaman?: number | null
  tubeColor: string
  coreColor: string
}

export interface OdcCreateData {
  name: string
  images?: string[]
  location?: string | null
  notes?: string | null
  keteranganJumlahKabelFeeder?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  otbCoreId: string | null
  outputs?: OdcOutputData[]
  siteId?: string | null
}

export interface OdcUpdateData {
  name?: string
  images?: string[]
  location?: string | null
  notes?: string | null
  keteranganJumlahKabelFeeder?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  otbCoreId?: string | null
  outputs?: OdcOutputData[]
  siteId?: string | null
}

export interface OdcPublic {
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
  otbCoreId: string | null
  siteId: string | null
}

export interface IOdcRepository {
  findAll(siteId?: string): Promise<OdcPublic[]>
  findById(id: string): Promise<OdcPublic | null>
  create(data: OdcCreateData): Promise<{ id: string }>
  update(id: string, data: OdcUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}


