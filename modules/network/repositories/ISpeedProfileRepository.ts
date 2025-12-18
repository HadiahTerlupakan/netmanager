export interface SpeedProfileCreateData {
  oltId: string
  profileType: string // "Download" atau "Upload"
  name: string
  type: number // 1-5
  bandwidthSir: number // dalam kbps
  burstPir: number // dalam kbps
  fixed?: number | null // dalam kbps
  assured?: number | null // dalam kbps
  maximum?: number | null // dalam kbps
}

export interface SpeedProfileUpdateData {
  profileType?: string
  name?: string
  type?: number
  bandwidthSir?: number
  burstPir?: number
  fixed?: number | null
  assured?: number | null
  maximum?: number | null
}

export interface SpeedProfilePublic {
  id: string
  oltId: string
  profileType: string
  name: string
  type: number
  bandwidthSir: number
  burstPir: number
  fixed: number | null
  assured: number | null
  maximum: number | null
  createdAt: Date
  updatedAt: Date
}

export interface ISpeedProfileRepository {
  findAll(): Promise<SpeedProfilePublic[]>
  findByOltId(oltId: string): Promise<SpeedProfilePublic[]>
  findById(id: string): Promise<SpeedProfilePublic | null>
  create(data: SpeedProfileCreateData): Promise<{ id: string }>
  update(id: string, data: SpeedProfileUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}

