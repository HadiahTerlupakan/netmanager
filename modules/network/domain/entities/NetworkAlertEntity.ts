export interface NetworkAlertCreateData {
  deviceId: string;
  deviceType: string;
  alertType: string;
  title: string;
  message: string;
  severity: string;
  threshold?: number;
  currentValue?: number;
  metricName?: string;
  autoResolve?: boolean;
  autoResolveTime?: number;
}

export interface NetworkAlertUpdateData {
  title?: string;
  message?: string;
  severity?: string;
  status?: string;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  resolved?: boolean;
  resolvedBy?: string;
  autoResolve?: boolean;
  autoResolveTime?: number;
}

export interface NetworkAlertFilters {
  deviceId?: string;
  deviceType?: "OLT" | "MIKROTIK" | "ONU";
  status?: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "SUPPRESSED";
  severity?: "CRITICAL" | "WARNING" | "INFO";
  alertType?: "CRITICAL" | "WARNING" | "INFO";
  acknowledged?: boolean;
  resolved?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface NetworkAlertEntity {
  id: string;
  deviceId: string;
  deviceType: string;
  alertType: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  threshold?: number | null;
  currentValue?: number | null;
  metricName?: string | null;
  acknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: Date | null;
  resolved: boolean;
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
  autoResolve: boolean;
  autoResolveTime?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
