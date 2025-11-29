import { LeaveType, LeaveStatus } from '@prisma/client'

export interface LeaveRequestPublic {
    id: string
    employeeId: string
    leaveType: LeaveType
    startDate: Date
    endDate: Date
    totalDays: number
    reason: string
    status: LeaveStatus
    approvedBy: string | null
    approvedAt: Date | null
    rejectionReason: string | null
    createdAt: Date
    updatedAt: Date
}

export interface LeaveRequestWithEmployee extends LeaveRequestPublic {
    employee: {
        id: string
        employeeId: string
        fullName: string
        department?: {
            name: string
        } | null
    }
}

export interface LeaveRequestCreateData {
    employeeId: string
    leaveType: LeaveType
    startDate: Date
    endDate: Date
    totalDays: number
    reason: string
}

export interface LeaveRequestUpdateData {
    status?: LeaveStatus
    approvedBy?: string | null
    approvedAt?: Date | null
    rejectionReason?: string | null
}

export interface LeaveRequestFilters {
    employeeId?: string
    status?: LeaveStatus
    leaveType?: LeaveType
    startDate?: Date
    endDate?: Date
}

export interface LeaveBalancePublic {
    id: string
    employeeId: string
    year: number
    leaveType: LeaveType
    totalDays: number
    usedDays: number
    remainingDays: number
    createdAt: Date
    updatedAt: Date
}

export interface ILeaveRequestRepository {
    findAll(filters?: LeaveRequestFilters): Promise<LeaveRequestWithEmployee[]>
    findById(id: string): Promise<LeaveRequestWithEmployee | null>
    findByEmployee(employeeId: string): Promise<LeaveRequestPublic[]>
    findPending(): Promise<LeaveRequestWithEmployee[]>
    create(data: LeaveRequestCreateData): Promise<{ id: string }>
    update(id: string, data: LeaveRequestUpdateData): Promise<void>
    delete(id: string): Promise<void>
    count(filters?: LeaveRequestFilters): Promise<number>
}

export interface ILeaveBalanceRepository {
    findByEmployee(employeeId: string, year: number): Promise<LeaveBalancePublic[]>
    findByEmployeeAndType(employeeId: string, year: number, leaveType: LeaveType): Promise<LeaveBalancePublic | null>
    create(data: Omit<LeaveBalancePublic, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ id: string }>
    update(id: string, data: Partial<LeaveBalancePublic>): Promise<void>
    initializeYearlyBalance(employeeId: string, year: number): Promise<void>
}
