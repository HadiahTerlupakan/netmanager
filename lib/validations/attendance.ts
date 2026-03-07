import { z } from 'zod'

/**
 * Attendance Status enum values
 */
export const AttendanceStatus = {
    ON_TIME: 'ON_TIME',
    LATE: 'LATE',
    ABSENT: 'ABSENT',
    SICK: 'SICK',
    PERMIT: 'PERMIT',
    DAY_OFF: 'DAY_OFF',
} as const

export type AttendanceStatusType = keyof typeof AttendanceStatus

/**
 * Query params validation for listing attendance
 */
const emptyToUndefined = (v: unknown) => {
    if (typeof v === 'string' && v === '') return undefined
    if (v === 'null' || v === 'undefined') return undefined
    return v
}

export const attendanceFilterSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    startDate: z.preprocess(emptyToUndefined, z.string().optional()),
    endDate: z.preprocess(emptyToUndefined, z.string().optional()),
    userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    siteId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    departmentId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    status: z.preprocess(emptyToUndefined, z.enum([
        AttendanceStatus.ON_TIME,
        AttendanceStatus.LATE,
        AttendanceStatus.ABSENT,
        AttendanceStatus.SICK,
        AttendanceStatus.PERMIT,
        AttendanceStatus.DAY_OFF,
    ]).optional()),
    search: z.preprocess(emptyToUndefined, z.string().optional()),
    export: z.preprocess((v) => (v === 'true' || v === true ? 'true' : v === 'false' || v === false ? 'false' : undefined), z.enum(['true', 'false']).optional()),
}).refine((data) => !(data.endDate && !data.startDate), {
    message: "startDate wajib diisi jika endDate dipilih",
    path: ["startDate"]
})

export type AttendanceFilter = z.infer<typeof attendanceFilterSchema>

/**
 * Request body validation for updating attendance
 */
export const attendanceUpdateSchema = z.object({
    checkIn: z.string().datetime().optional(),
    checkOut: z.string().datetime().optional().nullable(),
    status: z.enum([
        AttendanceStatus.ON_TIME,
        AttendanceStatus.LATE,
        AttendanceStatus.ABSENT,
        AttendanceStatus.SICK,
        AttendanceStatus.PERMIT,
        AttendanceStatus.DAY_OFF,
    ]).optional(),
    notes: z.string().max(500).optional().nullable(),
})

export type AttendanceUpdate = z.infer<typeof attendanceUpdateSchema>

/**
 * Check-in request validation
 */
export const checkInSchema = z.object({
    location: z.string().min(1, 'Location is required'),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    photoUrl: z.string().url().optional().nullable(),
    notes: z.string().max(500).optional(),
    offlineTime: z.string().datetime().optional(),
    timezone: z.string().optional(),
})

export type CheckInRequest = z.infer<typeof checkInSchema>

/**
 * Check-out request validation  
 */
export const checkOutSchema = z.object({
    location: z.string().optional().nullable(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    photoUrl: z.string().url().optional().nullable(),
    notes: z.string().max(500).optional(),
    offlineTime: z.string().datetime().optional(),
})

export type CheckOutRequest = z.infer<typeof checkOutSchema>
