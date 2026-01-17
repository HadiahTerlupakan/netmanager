export interface PoleCreateData {
  name: string
  images?: string[]
  location?: string | null
  notes?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  cableSlack?: boolean
  siteId?: string | null
}

export interface PoleUpdateData {
  name?: string
  images?: string[]
  location?: string | null
  notes?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  cableSlack?: boolean
  siteId?: string | null
}

export interface PolePublic {
  id: string
  name: string
  images: string[]
  location: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  cableSlack: boolean
  createdAt: Date
  updatedAt: Date
  siteId: string | null
}

export interface IPoleRepository {
  findAll(siteId?: string): Promise<PolePublic[]>
  findById(id: string): Promise<PolePublic | null>
  create(data: PoleCreateData): Promise<{ id: string }>
  update(id: string, data: PoleUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}


