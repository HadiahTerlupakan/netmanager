import { EmployeeType, WithdrawMethod } from '@prisma/client'

export interface CreateMitraDTO {
    name: string
    email: string
    password: string
    phone?: string
    employeeType: 'MITRA_TEKNISI' | 'MITRA_SALES'
    departmentId?: string
    siteId?: string
    roleId?: string
    mitraRateWo?: number
    mitraRateCanvasing?: number
    bankName?: string
    bankAccountNo?: string
    bankAccountName?: string
    targetHarian?: number
}

export interface UpdateMitraDTO {
    name?: string
    email?: string
    password?: string
    phone?: string
    employeeType?: 'MITRA_TEKNISI' | 'MITRA_SALES'
    departmentId?: string
    siteId?: string
    roleId?: string
    mitraRateWo?: number
    mitraRateCanvasing?: number
    bankName?: string
    bankAccountNo?: string
    bankAccountName?: string
    targetHarian?: number
    isActive?: boolean
}

export interface MitraFilters {
    search?: string
    employeeType?: EmployeeType
    isActive?: boolean
    departmentId?: string
    siteId?: string
}

export interface WithdrawRequestDTO {
    amount: number
    method: WithdrawMethod
    bankName?: string
    accountNumber?: string
    accountName?: string
    notes?: string
}

export interface MitraWithDetails {
    id: string
    name: string | null
    email: string
    phone: string | null
    employeeType: EmployeeType
    isActive: boolean
    mitraRateWo: number | null
    mitraRateCanvasing: number | null
    bankName: string | null
    bankAccountNo: string | null
    bankAccountName: string | null
    targetHarian: number | null
    departments: { name: string } | null
    sites: { name: string } | null
    role: { name: string } | null
    mitraWallet: {
        id: string
        balance: number
        totalEarnings: number
        totalWithdrawn: number
    } | null
    createdAt: Date
}
