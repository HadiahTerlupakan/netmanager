export interface NetworkPerformanceCreateData {
  deviceId: string;
  deviceType: string;
  cpuUsage?: number;
  memoryUsage?: number;
  temperature?: number;
  uptime?: number;
  rxBytes?: number;
  txBytes?: number;
  rxPackets?: number;
  txPackets?: number;
  rxDrops?: number;
  txDrops?: number;
  rxErrors?: number;
  txErrors?: number;
  interfaceStatus?: unknown;
  connectionCount?: number;
  bandwidthUsage?: number;
  signalStrength?: number;
  powerLevel?: string;
  customMetrics?: unknown;
}

export interface NetworkPerformanceUpdateData {
  cpuUsage?: number;
  memoryUsage?: number;
  temperature?: number;
  uptime?: number;
  rxBytes?: number;
  txBytes?: number;
  rxPackets?: number;
  txPackets?: number;
  rxDrops?: number;
  txDrops?: number;
  rxErrors?: number;
  txErrors?: number;
  interfaceStatus?: unknown;
  connectionCount?: number;
  bandwidthUsage?: number;
  signalStrength?: number;
  powerLevel?: string;
  customMetrics?: unknown;
}

export interface NetworkPerformanceFilters {
  deviceId?: string;
  deviceType?: "OLT" | "MIKROTIK" | "ONU";
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface NetworkPerformanceEntity {
  id: string;
  deviceId: string;
  deviceType: string;
  timestamp: Date;
  cpuUsage?: number | null;
  memoryUsage?: number | null;
  temperature?: number | null;
  uptime?: bigint | null;
  rxBytes?: bigint | null;
  txBytes?: bigint | null;
  rxPackets?: bigint | null;
  txPackets?: bigint | null;
  rxDrops?: bigint | null;
  txDrops?: bigint | null;
  rxErrors?: bigint | null;
  txErrors?: bigint | null;
  interfaceStatus?: unknown | null;
  connectionCount?: number | null;
  bandwidthUsage?: number | null;
  signalStrength?: number | null;
  powerLevel?: string | null;
  customMetrics?: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}
