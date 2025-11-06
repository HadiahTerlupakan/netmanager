export interface JoinboxIORowData {
  idx: number
  inputUnit: string
  portUnit: string
  tubeColor: string
  coreColor: string
}

export interface JoinboxCreateData {
  name: string
  location?: string | null
  notes?: string | null
  latitude?: number | null
  longitude?: number | null
  inputs?: JoinboxIORowData[]
  outputs?: JoinboxIORowData[]
}

export interface JoinboxUpdateData {
  name?: string
  location?: string | null
  notes?: string | null
  latitude?: number | null
  longitude?: number | null
  inputs?: JoinboxIORowData[]
  outputs?: JoinboxIORowData[]
}

export interface JoinboxPublic {
  id: string
  name: string
  location: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  createdAt: Date
  updatedAt: Date
}

export interface IJoinboxRepository {
  findAll(): Promise<JoinboxPublic[]>
  findById(id: string): Promise<JoinboxPublic | null>
  create(data: JoinboxCreateData): Promise<{ id: string }>
  update(id: string, data: JoinboxUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}


