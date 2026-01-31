export interface DeviceBackupPublic {
  id: string
  deviceId: string
  deviceType: string
  backupName: string
  description?: string | null
  fileUrl: string
  fileName: string
  fileSize: number
  checksum?: string | null
  version?: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface DeviceBackupCreateData {
  deviceId: string
  deviceType: string
  backupName: string
  description?: string | null
  fileUrl: string
  fileName: string
  fileSize: number
  checksum?: string | null
  version?: string | null
  status?: string
}

export interface DeviceBackupUpdateData {
  backupName?: string
  description?: string | null
  status?: string
}

export interface DeviceBackupFilters {
  deviceId?: string
  deviceType?: string
  status?: string
  limit?: number
  page?: number
}

export interface IDeviceBackupRepository {
  create(data: DeviceBackupCreateData): Promise<DeviceBackupPublic>
  findById(id: string): Promise<DeviceBackupPublic | null>
  findMany(filters?: DeviceBackupFilters): Promise<{ data: DeviceBackupPublic[], pagination: { total: number, page: number, limit: number, totalPages: number } }>
  update(id: string, data: DeviceBackupUpdateData): Promise<void>
  delete(id: string): Promise<void>
  findByDeviceId(deviceId: string, deviceType: string, filters?: DeviceBackupFilters): Promise<{ data: DeviceBackupPublic[], pagination: { total: number, page: number, limit: number, totalPages: number } }>
  count(filters?: DeviceBackupFilters): Promise<number>
}