export interface PoleCreateData {
  name: string
  location?: string | null
  notes?: string | null
  latitude?: number | null
  longitude?: number | null
  cableSlack?: boolean
}

export interface PoleUpdateData {
  name?: string
  location?: string | null
  notes?: string | null
  latitude?: number | null
  longitude?: number | null
  cableSlack?: boolean
}

export interface PolePublic {
  id: string
  name: string
  location: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  cableSlack: boolean
  createdAt: Date
  updatedAt: Date
}

export interface IPoleRepository {
  findAll(): Promise<PolePublic[]>
  findById(id: string): Promise<PolePublic | null>
  create(data: PoleCreateData): Promise<{ id: string }>
  update(id: string, data: PoleUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}


