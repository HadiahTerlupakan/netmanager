import { Employee, EmploymentStatus } from '@prisma/client'

export interface EmployeePublic {
    id: string
    employeeId: string
    userId: string | null
    fullName: string
    email: string | null
    phone: string | null
    dateOfBirth: Date | null
    gender: string | null
    idCardNumber: string | null
    address: string | null
    city: string | null
    province: string | null
    postalCode: string | null
    departmentId: string | null
    positionId: string | null
    employmentStatus: EmploymentStatus
    joinDate: Date
    endDate: Date | null
    probationEndDate: Date | null
    managerId: string | null
    emergencyName: string | null
    emergencyPhone: string | null
    emergencyRelation: string | null
    bankName: string | null
    bankAccountNumber: string | null
    bankAccountName: string | null
    npwp: string | null
    ptkpStatus: string | null
    photoUrl: string | null
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
        code: string | null
    } | null
    position?: {
        id: string
        title: string
        level: string | null
    } | null
}

export interface EmployeeCreateData {
    employeeId: string
    userId?: string | null
    fullName: string
    email?: string | null
    phone?: string | null
    dateOfBirth?: Date | null
    gender?: string | null
    idCardNumber?: string | null
    address?: string | null
    city?: string | null
    province?: string | null
    postalCode?: string | null
    departmentId?: string | null
    positionId?: string | null
    employmentStatus?: EmploymentStatus
    joinDate: Date
    endDate?: Date | null
    probationEndDate?: Date | null
    managerId?: string | null
    emergencyName?: string | null
    emergencyPhone?: string | null
    emergencyRelation?: string | null
    bankName?: string | null
    bankAccountNumber?: string | null
    bankAccountName?: string | null
    npwp?: string | null
    ptkpStatus?: string | null
    photoUrl?: string | null
    isActive?: boolean
    createdBy?: string | null
}

export interface EmployeeUpdateData {
    userId?: string | null
    fullName?: string
    email?: string | null
    phone?: string | null
    dateOfBirth?: Date | null
    gender?: string | null
    idCardNumber?: string | null
    address?: string | null
    city?: string | null
    province?: string | null
    postalCode?: string | null
    departmentId?: string | null
    positionId?: string | null
    employmentStatus?: EmploymentStatus
    joinDate?: Date
    endDate?: Date | null
    probationEndDate?: Date | null
    managerId?: string | null
    emergencyName?: string | null
    emergencyPhone?: string | null
    emergencyRelation?: string | null
    bankName?: string | null
    bankAccountNumber?: string | null
    bankAccountName?: string | null
    npwp?: string | null
    ptkpStatus?: string | null
    photoUrl?: string | null
    isActive?: boolean
    updatedBy?: string | null
}

export interface EmployeeFilters {
    departmentId?: string
    positionId?: string
    employmentStatus?: EmploymentStatus
    isActive?: boolean
    search?: string // Search by name, email, employeeId
}

export interface IEmployeeRepository {
    findAll(filters?: EmployeeFilters): Promise<EmployeeWithRelations[]>
    findById(id: string): Promise<EmployeeWithRelations | null>
    findByEmployeeId(employeeId: string): Promise<EmployeeWithRelations | null>
    findByUserId(userId: string): Promise<EmployeePublic | null>
    findByEmail(email: string): Promise<EmployeePublic | null>
    findByDepartment(departmentId: string): Promise<EmployeePublic[]>
    findByPosition(positionId: string): Promise<EmployeePublic[]>
    findByManager(managerId: string): Promise<EmployeePublic[]>
    findActiveEmployees(): Promise<EmployeePublic[]>
    create(data: EmployeeCreateData): Promise<{ id: string }>
    update(id: string, data: EmployeeUpdateData): Promise<void>
    delete(id: string): Promise<void>
    count(filters?: EmployeeFilters): Promise<number>
    countByStatus(status: EmploymentStatus): Promise<number>
    countByDepartment(departmentId: string): Promise<number>
}
