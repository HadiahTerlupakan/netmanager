import { PrismaClient } from '@prisma/client'

export interface ConfigurationRestoreCreateData {
  deviceId: string
  deviceType: string
  backupId: string
  restoreName: string
  description?: string
  restoreMethod?: string
  scheduledAt?: Date
  rollbackEnabled?: boolean
}

export interface ConfigurationRestoreUpdateData {
  restoreName?: string
  description?: string
  status?: string
  progress?: number
  errorMessage?: string
  warningMessage?: string
}

export interface ConfigurationRestoreFilters {
  deviceId?: string
  deviceType?: 'OLT' | 'MIKROTIK' | 'ONU'
  backupId?: string
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'ROLLED_BACK'
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ConfigurationRestorePublic {
  id: string
  deviceId: string
  deviceType: string
  backupId: string
  restoreName: string
  description?: string | null
  restoreMethod?: string | null
  status: string
  progress: number
  errorMessage?: string | null
  warningMessage?: string | null
  scheduledAt?: Date | null
  startedAt?: Date | null
  completedAt?: Date | null
  rollbackEnabled: boolean
  rollbackData?: any | null
  createdBy?: string | null
  verifiedBy?: string | null
  verifiedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface IConfigurationRestoreRepository {
  create(data: ConfigurationRestoreCreateData): Promise<ConfigurationRestorePublic>
  findById(id: string): Promise<ConfigurationRestorePublic | null>
  findMany(filters?: ConfigurationRestoreFilters): Promise<{ data: ConfigurationRestorePublic[], pagination: any }>
  update(id: string, data: ConfigurationRestoreUpdateData): Promise<void>
  delete(id: string): Promise<void>
  findByDeviceId(deviceId: string, deviceType: string, filters?: ConfigurationRestoreFilters): Promise<{ data: ConfigurationRestorePublic[], pagination: any }>
  findByBackupId(backupId: string, filters?: ConfigurationRestoreFilters): Promise<{ data: ConfigurationRestorePublic[], pagination: any }>
  count(filters?: ConfigurationRestoreFilters): Promise<number>
}