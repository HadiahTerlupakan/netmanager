import { AttendanceStatus } from '@prisma/client'

export interface AttendancePublic {
    id: string
    employeeId: string
    date: Date
    checkInTime: Date | null
    checkInLat: number | null
    checkInLng: number | null
    checkInNote: string | null
    checkOutTime: Date | null
    checkOutLat: number | null
    checkOutLng: number | null
    checkOutNote: string | null
    workingHours: number | null
    status: AttendanceStatus
    isManual: boolean
    correctedBy: string | null
    correctedAt: Date | null
    notes: string | null
    createdAt: Date
    updatedAt: Date
}

export interface AttendanceWithEmployee extends AttendancePublic {
    employee: {
        id: string
        employeeId: string
        fullName: string
        department?: {
            name: string
        } | null
    }
}

export interface AttendanceCreateData {
    employeeId: string
    date: Date
    checkInTime?: Date | null
    checkInLat?: number | null
    checkInLng?: number | null
    checkInNote?: string | null
    status?: AttendanceStatus
}

export interface AttendanceCheckOutData {
    checkOutTime: Date
    checkOutLat?: number | null
    checkOutLng?: number | null
    checkOutNote?: string | null
    workingHours?: number
}

export interface AttendanceUpdateData {
    checkInTime?: Date | null
    checkInLat?: number | null
    checkInLng?: number | null
    checkInNote?: string | null
    checkOutTime?: Date | null
    checkOutLat?: number | null
    checkOutLng?: number | null
    checkOutNote?: string | null
    workingHours?: number | null
    status?: AttendanceStatus
    isManual?: boolean
    correctedBy?: string | null
    notes?: string | null
}

export interface AttendanceFilters {
    employeeId?: string
    departmentId?: string
    startDate?: Date
    endDate?: Date
    status?: AttendanceStatus
}

export interface IAttendanceRepository {
    findAll(filters?: AttendanceFilters): Promise<AttendanceWithEmployee[]>
    findById(id: string): Promise<AttendanceWithEmployee | null>
    findByEmployeeAndDate(employeeId: string, date: Date): Promise<AttendancePublic | null>
    findByEmployee(employeeId: string, startDate?: Date, endDate?: Date): Promise<AttendancePublic[]>
    findByDate(date: Date): Promise<AttendanceWithEmployee[]>
    findByDateRange(startDate: Date, endDate: Date): Promise<AttendanceWithEmployee[]>
    create(data: AttendanceCreateData): Promise<{ id: string }>
    checkOut(id: string, data: AttendanceCheckOutData): Promise<void>
    update(id: string, data: AttendanceUpdateData): Promise<void>
    delete(id: string): Promise<void>
    count(filters?: AttendanceFilters): Promise<number>
    getSummary(date: Date): Promise<{ present: number; late: number; absent: number; leave: number }>
}
