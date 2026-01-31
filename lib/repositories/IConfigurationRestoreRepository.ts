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
  rollbackData?: Record<string, unknown> | null
  createdBy?: string | null
  verifiedBy?: string | null
  verifiedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ConfigurationRestoreCreateData {
  deviceId: string
  deviceType: string
  backupId: string
  restoreName: string
  description?: string | null
  restoreMethod?: string | null
  status?: string
  rollbackEnabled?: boolean
  scheduledAt?: Date | null
  createdBy?: string | null
}

export interface ConfigurationRestoreUpdateData {
  status?: string
  progress?: number
  errorMessage?: string | null
  warningMessage?: string | null
  startedAt?: Date | null
  completedAt?: Date | null
  verifiedBy?: string | null
  verifiedAt?: Date | null
}

export interface ConfigurationRestoreFilters {
  deviceId?: string
  deviceType?: string
  backupId?: string
  status?: string
  limit?: number
  page?: number
}

export interface IConfigurationRestoreRepository {
  create(data: ConfigurationRestoreCreateData): Promise<ConfigurationRestorePublic>
  findById(id: string): Promise<ConfigurationRestorePublic | null>
  findMany(filters?: ConfigurationRestoreFilters): Promise<{ data: ConfigurationRestorePublic[], pagination: { total: number, page: number, limit: number, totalPages: number } }>
  update(id: string, data: ConfigurationRestoreUpdateData): Promise<void>
  delete(id: string): Promise<void>
  findByDeviceId(deviceId: string, deviceType: string, filters?: ConfigurationRestoreFilters): Promise<{ data: ConfigurationRestorePublic[], pagination: { total: number, page: number, limit: number, totalPages: number } }>
  findByBackupId(backupId: string, filters?: ConfigurationRestoreFilters): Promise<{ data: ConfigurationRestorePublic[], pagination: { total: number, page: number, limit: number, totalPages: number } }>
  count(filters?: ConfigurationRestoreFilters): Promise<number>
}