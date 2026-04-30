/**
 * Network DTOs (Data Transfer Objects)
 */

import type { Status } from "../types/network.enums";

// ==================== MikroTik Router DTOs ====================

/**
 * DTO for router list views
 */
export interface RouterListItemDTO {
  id: string;
  name: string;
  ipAddress: string;
  pingStatus: string;
  userOnline: number;
  lastStatusCheck: string | null;
  siteName: string | null;
}

/**
 * DTO for router detail views
 */
export interface RouterDetailDTO {
  id: string;
  name: string;
  ipAddress: string;
  timezone: string;
  apiPort: number;
  apiUsername: string;
  authPort: number;
  accountingPort: number;
  isolirUrl: string | null;
  description: string | null;
  pingStatus: string;
  userOnline: number;
  lastStatusCheck: string | null;
  createdAt: string;
  updatedAt: string;
  site: {
    id: string;
    name: string;
  } | null;
}

/**
 * DTO for router option
 */
export interface RouterOptionDTO {
  id: string;
  name: string;
  ipAddress: string;
}

// ==================== ODP DTOs ====================

/**
 * DTO for ODP list views
 */
export interface OdpListItemDTO {
  id: string;
  name: string;
  location: string | null;
  status: Status;
  latitude: number | null;
  longitude: number | null;
  siteName: string | null;
  outputCount: number;
  pelangganCount: number;
}

/**
 * DTO for ODP detail views
 */
export interface OdpDetailDTO {
  id: string;
  name: string;
  location: string | null;
  notes: string | null;
  images: string[];
  latitude: number | null;
  longitude: number | null;
  status: Status;
  keteranganJumlahKabelFeeder: string | null;
  createdAt: string;
  updatedAt: string;
  site: {
    id: string;
    name: string;
  } | null;
  outputs: OdpOutputDTO[];
}

/**
 * DTO for ODP output
 */
export interface OdpOutputDTO {
  id: string;
  idx: number;
  slotName: string;
  redaman: number | null;
  tubeColor: string;
  coreColor: string;
}

/**
 * DTO for ODP option
 */
export interface OdpOptionDTO {
  id: string;
  name: string;
  location: string | null;
}

// ==================== HargaPaket DTOs ====================

/**
 * DTO for package list views
 */
export interface HargaPaketListItemDTO {
  id: string;
  name: string;
  harga: number;
  durasi: number;
  durasiUnit: string;
  status: Status;
  featured: boolean;
  bandwidthName: string | null;
}

/**
 * DTO for package detail views
 */
export interface HargaPaketDetailDTO {
  id: string;
  name: string;
  harga: number;
  durasi: number;
  durasiUnit: string;
  usePPN: boolean;
  ppnPercentage: number | null;
  useDiscount: boolean;
  discountType: string | null;
  discountValue: number | null;
  discountDuration: number | null;
  description: string | null;
  featured: boolean;
  status: Status;
  createdAt: string;
  updatedAt: string;
  bandwidth: {
    id: string;
    name: string;
  } | null;
  profilePPP: {
    id: string;
    name: string;
  };
  pelangganCount: number;
}

/**
 * DTO for package option
 */
export interface HargaPaketOptionDTO {
  id: string;
  name: string;
  harga: number;
}

// ==================== Request DTOs ====================

/**
 * DTO for creating router
 */
export interface CreateRouterDTO {
  name: string;
  ipAddress: string;
  apiPort?: number;
  apiUsername: string;
  apiPassword: string;
  authPort?: number;
  accountingPort?: number;
  secretRadius: string;
  siteId?: string;
  description?: string;
}

/**
 * DTO for creating package
 */
export interface CreateHargaPaketDTO {
  name: string;
  profilePPPId: string;
  bandwidthId?: string;
  harga: number;
  durasi?: number;
  durasiUnit?: string;
  usePPN?: boolean;
  ppnPercentage?: number;
  description?: string;
  featured?: boolean;
}

/**
 * DTO for network alert responses
 */
export interface NetworkAlertDTO {
  id: string;
  deviceId: string;
  deviceType: string;
  alertType: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  threshold: number | null;
  currentValue: number | null;
  metricName: string | null;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  autoResolve: boolean;
  autoResolveTime: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for network performance responses
 */
export interface NetworkPerformanceDTO {
  id: string;
  deviceId: string;
  deviceType: string;
  timestamp: string;
  cpuUsage: number | null;
  memoryUsage: number | null;
  temperature: number | null;
  uptime: number | null;
  rxBytes: number | null;
  txBytes: number | null;
  rxPackets: number | null;
  txPackets: number | null;
  rxDrops: number | null;
  txDrops: number | null;
  rxErrors: number | null;
  txErrors: number | null;
  interfaceStatus: unknown | null;
  connectionCount: number | null;
  bandwidthUsage: number | null;
  signalStrength: number | null;
  powerLevel: string | null;
  customMetrics: unknown | null;
  createdAt: string;
  updatedAt: string;
}
