export interface KmzFileCreateData {
  name: string
  filename: string
  filePath: string
  kmlPath: string
  fileSize: number
  description?: string | null
  lineColor?: string
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
}

export interface KmzFileUpdateData {
  name?: string
  description?: string | null
  lineColor?: string
  isActive?: boolean
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
}

export interface KmzFilePublic {
  id: string
  name: string
  filename: string
  filePath: string
  kmlPath: string
  fileSize: number
  description: string | null
  lineColor: string
  isActive: boolean
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  createdAt: Date
  updatedAt: Date
}

export interface IKmzRepository {
  findAll(): Promise<KmzFilePublic[]>
  findById(id: string): Promise<KmzFilePublic | null>
  findActive(): Promise<KmzFilePublic[]>
  create(data: KmzFileCreateData): Promise<{ id: string }>
  update(id: string, data: KmzFileUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}

