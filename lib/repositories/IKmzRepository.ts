export interface KmzFileCreateData {
  name: string
  filename: string
  filePath: string
  kmlPath: string
  fileSize: number
  description?: string | null
  lineColor?: string
}

export interface KmzFileUpdateData {
  name?: string
  description?: string | null
  lineColor?: string
  isActive?: boolean
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

