import * as z from "zod";

export const networkPerformanceCreateSchema = z.object({
  deviceId: z.string().min(1, "Device ID wajib diisi"),
  deviceType: z.enum(["OLT", "MIKROTIK", "ONU"]),
  cpuUsage: z.number().min(0).max(100).optional(),
  memoryUsage: z.number().min(0).max(100).optional(),
  temperature: z.number().optional(),
  uptime: z.number().optional(),
  rxBytes: z.number().optional(),
  txBytes: z.number().optional(),
  rxPackets: z.number().optional(),
  txPackets: z.number().optional(),
  rxDrops: z.number().optional(),
  txDrops: z.number().optional(),
  rxErrors: z.number().optional(),
  txErrors: z.number().optional(),
  interfaceStatus: z.any().optional(),
  connectionCount: z.number().int().min(0).optional(),
  bandwidthUsage: z.number().min(0).optional(),
  signalStrength: z.number().optional(),
  powerLevel: z.string().optional(),
  customMetrics: z.any().optional(),
});

export const networkPerformanceQuerySchema = z.object({
  deviceId: z.string().optional(),
  deviceType: z.enum(["OLT", "MIKROTIK", "ONU"]).optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["timestamp", "cpuUsage", "memoryUsage", "temperature"])
    .default("timestamp"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const networkAlertCreateSchema = z.object({
  deviceId: z.string().min(1, "Device ID wajib diisi"),
  deviceType: z.enum(["OLT", "MIKROTIK", "ONU"]),
  alertType: z.enum(["CRITICAL", "WARNING", "INFO"]),
  title: z.string().min(1, "Judul alert wajib diisi"),
  message: z.string().min(1, "Pesan alert wajib diisi"),
  severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
  threshold: z.number().optional(),
  currentValue: z.number().optional(),
  metricName: z.string().optional(),
  autoResolve: z.boolean().default(false),
  autoResolveTime: z.number().int().min(1).optional(),
});

export const networkAlertUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  severity: z.enum(["CRITICAL", "WARNING", "INFO"]).optional(),
  status: z
    .enum(["ACTIVE", "ACKNOWLEDGED", "RESOLVED", "SUPPRESSED"])
    .optional(),
  acknowledged: z.boolean().optional(),
  resolved: z.boolean().optional(),
  autoResolve: z.boolean().optional(),
  autoResolveTime: z.number().int().min(1).optional(),
});

export const networkAlertQuerySchema = z.object({
  deviceId: z.string().optional(),
  deviceType: z.enum(["OLT", "MIKROTIK", "ONU"]).optional(),
  status: z
    .enum(["ACTIVE", "ACKNOWLEDGED", "RESOLVED", "SUPPRESSED"])
    .optional(),
  severity: z.enum(["CRITICAL", "WARNING", "INFO"]).optional(),
  alertType: z.enum(["CRITICAL", "WARNING", "INFO"]).optional(),
  acknowledged: z.coerce.boolean().optional(),
  resolved: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "severity", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
