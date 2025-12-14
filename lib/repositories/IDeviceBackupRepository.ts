import { PrismaClient } from '@prisma/client'

export interface DeviceBackupCreateData {
  deviceId: string
  deviceType: string
  backupName: string
  description?: string
  backupType?: string
  backupMethod?: string
  scheduledAt?: Date
  retentionDays?: number
  isAutoCleanup?: boolean
}

export interface DeviceBackupUpdateData {
  backupName?: string
  description?: string
  retentionDays?: number
  isAutoCleanup?: boolean
}

export interface DeviceBackupFilters {
  deviceId?: string
  deviceType?: 'OLT' | 'MIKROTIK' | 'ONU'
  backupType?: 'MANUAL' | 'SCHEDULED' | 'AUTOMATIC'
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface DeviceBackupPublic {
  id: string
  deviceId: string
  deviceType: string
  backupName: string
  description?: string | null
  backupType: string
  filePath: string
  fileSize: number
  fileHash?: string | null
  compressionType?: string | null
  isEncrypted: boolean
  encryptionKey?: string | null
  backupMethod?: string | null
  status: string
  errorMessage?: string | null
  scheduledAt?: Date | null
  completedAt?: Date | null
  createdBy?: string | null
  retentionDays: number
  isAutoCleanup: boolean
  createdAt: Date
  updatedAt: Date
}

export interface IDeviceBackupRepository {
  create(data: DeviceBackupCreateData): Promise<DeviceBackupPublic>
  findById(id: string): Promise<DeviceBackupPublic | null>
  findMany(filters?: DeviceBackupFilters): Promise<{ data: DeviceBackupPublic[], pagination: any }>
  update(id: string, data: DeviceBackupUpdateData): Promise<void>
  delete(id: string): Promise<void>
  findByDeviceId(deviceId: string, deviceType: string, filters?: DeviceBackupFilters): Promise<{ data: DeviceBackupPublic[], pagination: any }>
  count(filters?: DeviceBackupFilters): Promise<number>
}