import * as z from "zod";

export const deviceBackupCreateSchema = z.object({
  deviceId: z.string().min(1, "Device ID wajib diisi"),
  deviceType: z.enum(["OLT", "MIKROTIK", "ONU"]),
  backupName: z.string().min(1, "Nama backup wajib diisi"),
  description: z.string().optional(),
  backupType: z.enum(["MANUAL", "SCHEDULED", "AUTOMATIC"]).default("MANUAL"),
  backupMethod: z.string().optional(),
  scheduledAt: z.iso.datetime().optional(),
  retentionDays: z.number().int().min(1).default(30),
  isAutoCleanup: z.boolean().default(false),
  filePath: z.string().min(1, "File path wajib diisi"),
  fileSize: z.number().int().min(0, "Ukuran file harus positif"),
  fileHash: z.string().optional(),
  compressionType: z.string().optional(),
  isEncrypted: z.boolean().default(false),
  encryptionKey: z.string().optional(),
  status: z
    .enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"])
    .default("COMPLETED"),
});

export const deviceBackupUpdateSchema = z.object({
  backupName: z.string().min(1).optional(),
  description: z.string().optional(),
  retentionDays: z.number().int().min(1).optional(),
  isAutoCleanup: z.boolean().optional(),
});

export const deviceBackupQuerySchema = z.object({
  deviceId: z.string().optional(),
  deviceType: z.enum(["OLT", "MIKROTIK", "ONU"]).optional(),
  backupType: z.enum(["MANUAL", "SCHEDULED", "AUTOMATIC"]).optional(),
  status: z
    .enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"])
    .optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["createdAt", "completedAt", "backupName"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const configurationRestoreCreateSchema = z.object({
  deviceId: z.string().min(1, "Device ID wajib diisi"),
  deviceType: z.enum(["OLT", "MIKROTIK", "ONU"]),
  backupId: z.string().min(1, "Backup ID wajib diisi"),
  restoreName: z.string().min(1, "Nama restore wajib diisi"),
  description: z.string().optional(),
  restoreMethod: z.string().optional(),
  scheduledAt: z.iso.datetime().optional(),
  rollbackEnabled: z.boolean().default(false),
});

export const configurationRestoreUpdateSchema = z.object({
  restoreName: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z
    .enum([
      "PENDING",
      "IN_PROGRESS",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
      "ROLLED_BACK",
    ])
    .optional(),
  progress: z.number().int().min(0).max(100).optional(),
  errorMessage: z.string().optional(),
  warningMessage: z.string().optional(),
});

export const configurationRestoreQuerySchema = z.object({
  deviceId: z.string().optional(),
  deviceType: z.enum(["OLT", "MIKROTIK", "ONU"]).optional(),
  backupId: z.string().optional(),
  status: z
    .enum([
      "PENDING",
      "IN_PROGRESS",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
      "ROLLED_BACK",
    ])
    .optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["createdAt", "scheduledAt", "completedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
