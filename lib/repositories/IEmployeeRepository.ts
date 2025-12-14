import type { Employee } from '@prisma/client'

export interface EmployeePublic {
    id: string
    employeeId: string
    userId: string | null
    fullName: string
    email: string | null
    phone: string | null
    departmentId: string | null
    positionId: string | null
    siteId: string | null
    joinDate: Date
    status: string
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    createdBy: string | null
    updatedBy: string | null
}

export interface EmployeeWithRelations extends EmployeePublic {
    department?: {
        id: string
        name: string
    } | null
    position?: {
        id: string
        title: string
        level?: string | null
    } | null
    site?: {
        id: string
        code: string
        name: string
    } | null
}

export interface EmployeeCreateData {
    employeeId: string
    userId?: string | null
    fullName: string
    email?: string | null
    phone?: string | null
    departmentId?: string | null
    positionId?: string | null
    siteId?: string | null
    joinDate: Date
    status?: string
    isActive?: boolean
    createdBy?: string | null
}

export interface EmployeeUpdateData {
    userId?: string | null
    fullName?: string
    email?: string | null
    phone?: string | null
    departmentId?: string | null
    positionId?: string | null
    siteId?: string | null
    joinDate?: Date
    status?: string
    isActive?: boolean
    updatedBy?: string | null
}

export interface EmployeeFilters {
    departmentId?: string
    positionId?: string
    status?: string
    isActive?: boolean
    search?: string
}

export interface IEmployeeRepository {
    findAll(filters?: EmployeeFilters): Promise<EmployeeWithRelations[]>
    findById(id: string): Promise<EmployeeWithRelations | null>
    findByEmployeeId(employeeId: string): Promise<EmployeeWithRelations | null>
    findByUserId(userId: string): Promise<EmployeePublic | null>
    findByEmail(email: string): Promise<EmployeePublic | null>
    findByDepartment(departmentId: string): Promise<EmployeePublic[]>
    findByPosition(positionId: string): Promise<EmployeePublic[]>
    findActiveEmployees(): Promise<EmployeePublic[]>
    create(data: EmployeeCreateData): Promise<{ id: string }>
    update(id: string, data: EmployeeUpdateData): Promise<void>
    delete(id: string): Promise<void>
    count(filters?: EmployeeFilters): Promise<number>
    countByDepartment(departmentId: string): Promise<number>
}
