/**
 * Attendance DTOs (Data Transfer Objects)
 *
 * DTOs define the shape of data for API responses and requests.
 */

import type { AttendanceStatus } from '@prisma/client'

// ==================== Response DTOs ====================

/**
 * Minimal DTO for list/table views
 */
export interface AttendanceListItemDTO {
    id: string
    date: string
    checkInTime: string | null
    checkOutTime: string | null
    status: AttendanceStatus
    totalHours: number | null
    location: string | null
    // Flattened relations
    userName: string | null
    userEmail: string | null
    departmentName: string | null
}

/**
 * Full DTO for detail views
 */
export interface AttendanceDetailDTO {
    id: string
    date: string
    checkInTime: string | null
    checkOutTime: string | null
    status: AttendanceStatus
    totalHours: number | null
    location: string | null
    notes: string | null
    // Photos
    checkInPhoto: string | null
    checkOutPhoto: string | null
    // Geofence
    geofence: {
        status: string | null
        distance: number | null
        siteName: string | null
    }
    // User
    user: {
        id: string
        name: string | null
        email: string
        departmentName: string | null
    }
    // Metadata
    createdAt: string
    updatedAt: string
}

/**
 * DTO for mobile app check-in response
 */
export interface CheckInResponseDTO {
    id: string
    checkInTime: string
    status: AttendanceStatus
    location: string | null
    geofenceStatus: string | null
    geofenceSiteName: string | null
    message: string
}

/**
 * DTO for mobile app check-out response
 */
export interface CheckOutResponseDTO {
    id: string
    checkInTime: string
    checkOutTime: string
    totalHours: number
    status: AttendanceStatus
    message: string
}

/**
 * DTO for daily summary
 */
export interface AttendanceSummaryDTO {
    date: string
    totalEmployees: number
    present: number
    late: number
    absent: number
    onLeave: number
    percentagePresent: number
}

/**
 * DTO for employee monthly report
 */
export interface MonthlyAttendanceDTO {
    userId: string
    userName: string | null
    month: string // YYYY-MM
    workDays: number
    presentDays: number
    lateDays: number
    absentDays: number
    leaveDays: number
    totalHours: number
    averageHoursPerDay: number
}

// ==================== Request DTOs ====================

/**
 * DTO for check-in request
 */
export interface CheckInRequestDTO {
    photoUrl?: string
    location?: string
    notes?: string
    latitude?: number
    longitude?: number
    offlineTime?: string // ISO string for offline sync
    timezone?: string
}

/**
 * DTO for check-out request
 */
export interface CheckOutRequestDTO {
    photoUrl?: string
    notes?: string
    latitude?: number
    longitude?: number
    offlineTime?: string
    timezone?: string
}

/**
 * DTO for admin manual attendance entry
 */
export interface ManualAttendanceDTO {
    userId: string
    date: string
    checkInTime: string
    checkOutTime?: string
    status: AttendanceStatus
    notes?: string
}
