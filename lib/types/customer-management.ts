// Customer Management API Types

export interface CustomerUsageResponse {
  success: boolean
  customer: {
    id: string
    idPelanggan: string
    nama: string
    username: string
    status: string
  }
  period: {
    type: string
    startDate: string
    endDate: string
  }
  usage: {
    totalSessions: number
    totalSessionTime: string
    totalSessionTimeHours: number
    totalInputOctets: string
    totalOutputOctets: string
    totalInputGB: number
    totalOutputGB: number
    totalGB: number
    activeSessions: number
    dbSessionCount: number
    dbTotalSessionTime: string
    dbTotalUploadBytes: string
    dbTotalDownloadBytes: string
    dbTotalBytes: string
    dbTotalSessionTimeHours: number
    dbTotalUploadGB: number
    dbTotalDownloadGB: number
    dbTotalGB: number
  }
  activeSession: {
    sessionId: string
    startTime: string
    nasIpAddress: string
    callingStationId: string
  } | null
}

export interface CustomerUsageHistoryResponse {
  success: boolean
  customer: {
    id: string
    idPelanggan: string
    nama: string
    username: string
    status: string
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: {
    startDate: string | null
    endDate: string | null
    source: string
  }
  data: CustomerUsageHistoryItem[]
}

export interface CustomerUsageHistoryItem {
  id: string
  sessionId: string
  sessionStartTime: string
  sessionEndTime: string | null
  sessionDuration: string
  sessionDurationMinutes: number
  uploadBytes: string
  downloadBytes: string
  totalBytes: string
  uploadGB: number
  downloadGB: number
  totalGB: number
  nasIpAddress: string | null
  callingStationId: string | null
  calledStationId: string | null
  terminateCause: string | null
  source: 'radius' | 'database'
}

export interface SuspendCustomerRequest {
  suspensionType: 'PAYMENT' | 'VIOLATION' | 'MAINTENANCE' | 'REQUEST'
  reason: string
  notes?: string
  expectedResumeAt?: string
  terminateActiveSessions?: boolean
}

export interface SuspendCustomerResponse {
  success: boolean
  message: string
  suspension: {
    id: string
    suspensionType: string
    reason: string
    notes: string | null
    suspendedAt: string
    expectedResumeAt: string | null
    suspendedBy: string
    isActive: boolean
  }
  customer: {
    id: string
    idPelanggan: string
    nama: string
    username: string
    status: string
  }
}

export interface ActivateCustomerRequest {
  notes?: string
  activationMethod?: 'MANUAL' | 'AUTOMATIC' | 'PAYMENT_CONFIRMED'
  syncToRadius?: boolean
}

export interface ActivateCustomerResponse {
  success: boolean
  message: string
  suspension: {
    id: string
    suspensionType: string
    reason: string
    suspendedAt: string
    actualResumeAt: string
    resumedBy: string
    isActive: boolean
    notes: string | null
  }
  customer: {
    id: string
    idPelanggan: string
    nama: string
    username: string
    status: string
  }
}

export interface SuspensionHistoryResponse {
  success: boolean
  customer: {
    id: string
    idPelanggan: string
    nama: string
    username: string
    status: string
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: {
    suspensionType: string | null
    status: string
    startDate: string | null
    endDate: string | null
    sortBy: string
    sortOrder: string
  }
  statistics: {
    totalSuspensions: number
    activeSuspensions: number
    averageSuspensionDuration: number
    mostCommonReason: string | null
  }
  data: SuspensionHistoryItem[]
}

export interface SuspensionHistoryItem {
  id: string
  suspensionType: 'PAYMENT' | 'VIOLATION' | 'MAINTENANCE' | 'REQUEST'
  reason: string
  suspendedAt: string
  suspendedBy: string
  suspendedByuser: {
    id: string
    name: string
    email: string
  } | null
  expectedResumeAt: string | null
  actualResumeAt: string | null
  resumedBy: string
  resumedByuser: {
    id: string
    name: string
    email: string
  } | null
  notes: string | null
  isActive: boolean
  durationHours: number | null
}

// Query parameter types
export interface UsageQueryParams {
  page?: number
  limit?: number
  startDate?: string
  endDate?: string
  period?: 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days' | 'custom'
}

export interface UsageHistoryQueryParams extends UsageQueryParams {
  source?: 'all' | 'radius' | 'database'
  sortBy?: 'sessionStartTime' | 'sessionDuration' | 'totalBytes'
  sortOrder?: 'asc' | 'desc'
}

export interface SuspensionHistoryQueryParams {
  page?: number
  limit?: number
  suspensionType?: 'PAYMENT' | 'VIOLATION' | 'MAINTENANCE' | 'REQUEST'
  status?: 'active' | 'inactive' | 'all'
  startDate?: string
  endDate?: string
  sortBy?: 'suspendedAt' | 'actualResumeAt' | 'suspendedBy'
  sortOrder?: 'asc' | 'desc'
}