export interface DepartmentPublic {
    id: string
    name: string
    code: string | null
    description: string | null
    headId: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

export interface DepartmentWithEmployeeCount extends DepartmentPublic {
    _count: {
        employees: number
    }
}

export interface DepartmentCreateData {
    name: string
    code?: string | null
    description?: string | null
    headId?: string | null
    isActive?: boolean
}

export interface DepartmentUpdateData {
    name?: string
    code?: string | null
    description?: string | null
    headId?: string | null
    isActive?: boolean
}

export interface IDepartmentRepository {
    findAll(): Promise<DepartmentWithEmployeeCount[]>
    findById(id: string): Promise<DepartmentPublic | null>
    findByCode(code: string): Promise<DepartmentPublic | null>
    findActive(): Promise<DepartmentPublic[]>
    create(data: DepartmentCreateData): Promise<{ id: string }>
    update(id: string, data: DepartmentUpdateData): Promise<void>
    delete(id: string): Promise<void>
    count(): Promise<number>
}
