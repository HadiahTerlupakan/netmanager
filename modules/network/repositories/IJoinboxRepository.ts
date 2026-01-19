export interface JoinboxIORowData {
  idx: number
  inputUnit: string
  portUnit: string
  tubeColor: string
  coreColor: string
}

export interface JoinboxCreateData {
  name: string
  images?: string[]
  location?: string | null
  notes?: string | null
  keteranganJumlahKabelFeeder?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  inputs?: JoinboxIORowData[]
  outputs?: JoinboxIORowData[]
  siteId?: string | null
}

export interface JoinboxUpdateData {
  name?: string
  images?: string[]
  location?: string | null
  notes?: string | null
  keteranganJumlahKabelFeeder?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  inputs?: JoinboxIORowData[]
  outputs?: JoinboxIORowData[]
  siteId?: string | null
}

export interface JoinboxPublic {
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
  siteId?: string | null
}

export interface IJoinboxRepository {
  findAll(siteId?: string): Promise<JoinboxPublic[]>
  findById(id: string): Promise<JoinboxPublic | null>
  create(data: JoinboxCreateData): Promise<{ id: string }>
  update(id: string, data: JoinboxUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}


