export type DeviceBackupStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
export type DeviceBackupType = "MANUAL" | "SCHEDULED" | "AUTOMATIC";
export type ConfigurationRestoreStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "ROLLED_BACK";

export interface DeviceBackupEntity {
  id: string;
  deviceId: string;
  deviceType: string;
  backupName: string;
  description: string | null;
  backupType: DeviceBackupType;
  filePath: string;
  fileSize: number;
  fileHash: string | null;
  compressionType: string | null;
  isEncrypted: boolean;
  encryptionKey: string | null;
  backupMethod: string | null;
  status: DeviceBackupStatus;
  errorMessage: string | null;
  scheduledAt: Date | null;
  completedAt: Date | null;
  createdBy: string | null;
  retentionDays: number;
  isAutoCleanup: boolean;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string | null;
}

export interface ConfigurationRestoreEntity {
  id: string;
  deviceId: string;
  deviceType: string;
  backupId: string;
  restoreName: string;
  description: string | null;
  restoreMethod: string | null;
  status: ConfigurationRestoreStatus;
  progress: number;
  errorMessage: string | null;
  warningMessage: string | null;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  rollbackEnabled: boolean;
  rollbackData: unknown;
  createdBy: string | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string | null;
}

export interface DeviceBackupListFilters {
  deviceId?: string;
  deviceType?: string;
  backupType?: DeviceBackupType;
  status?: DeviceBackupStatus;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
  sortBy: "createdAt" | "completedAt" | "backupName";
  sortOrder: "asc" | "desc";
}

export interface DeviceBackupListResultEntity {
  data: DeviceBackupEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
}

export interface CreateDeviceBackupEntityInput {
  deviceId: string;
  deviceType: string;
  backupName: string;
  description?: string;
  backupType: DeviceBackupType;
  filePath: string;
  fileSize: number;
  fileHash?: string;
  compressionType?: string;
  isEncrypted: boolean;
  encryptionKey?: string;
  backupMethod?: string;
  status: DeviceBackupStatus;
  scheduledAt?: string;
  createdBy: string;
  retentionDays?: number;
  isAutoCleanup: boolean;
}

export interface CreateConfigurationRestoreEntityInput {
  deviceId: string;
  deviceType: string;
  backupId: string;
  restoreName: string;
  description?: string;
  restoreMethod?: string;
  scheduledAt?: string;
  rollbackEnabled?: boolean;
  createdBy: string;
}
