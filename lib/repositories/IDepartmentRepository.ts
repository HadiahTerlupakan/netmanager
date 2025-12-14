export interface DepartmentPublic {
    id: string
    name: string
    description: string | null
    jobDescription: string | null
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
    description?: string | null
    jobDescription?: string | null
}

export interface DepartmentUpdateData {
    name?: string
    description?: string | null
    jobDescription?: string | null
}

export interface IDepartmentRepository {
    findAll(): Promise<DepartmentWithEmployeeCount[]>
    findById(id: string): Promise<DepartmentPublic | null>
    findByName(name: string): Promise<DepartmentPublic | null>
    create(data: DepartmentCreateData): Promise<{ id: string }>
    update(id: string, data: DepartmentUpdateData): Promise<void>
    delete(id: string): Promise<void>
    count(): Promise<number>
}
