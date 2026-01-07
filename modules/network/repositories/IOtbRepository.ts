export interface OtbCreateData {
  name: string
  location?: string | null
  coreCount: number
  notes?: string | null
  keteranganJumlahKabelFeeder?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' | 'ISOLIR' | 'DISMANTLE'
  cores?: Array<{
    idx: number
    slotName: string
    tubeColor: string
    coreColor: string
  }>
  siteId?: string | null
}

export interface OtbUpdateData {
  name?: string
  location?: string | null
  coreCount?: number
  notes?: string | null
  keteranganJumlahKabelFeeder?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' | 'ISOLIR' | 'DISMANTLE'
  cores?: Array<{
    idx: number
    slotName: string
    tubeColor: string
    coreColor: string
  }>
  siteId?: string | null
}

export interface OtbPublic {
  id: string
  name: string
  location: string | null
  coreCount: number
  notes: string | null
  keteranganJumlahKabelFeeder: string | null
  latitude: number | null
  longitude: number | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' | 'ISOLIR' | 'DISMANTLE'
  createdAt: Date
  updatedAt: Date
  siteId: string | null
}

export interface IOtbRepository {
  findAll(siteId?: string): Promise<OtbPublic[]>
  findById(id: string): Promise<OtbPublic | null>
  create(data: OtbCreateData): Promise<{ id: string }>
  update(id: string, data: OtbUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}


