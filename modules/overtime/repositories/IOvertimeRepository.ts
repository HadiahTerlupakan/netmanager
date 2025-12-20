import { type Overtime, type OvertimeStatus, Prisma } from '@prisma/client'

export interface IOvertimeRepository {
    findById(id: string): Promise<Overtime | null>
    findAll(filters?: {
        userId?: string
        status?: OvertimeStatus
        startDate?: Date
        endDate?: Date
    }): Promise<Overtime[]>
    create(data: Prisma.OvertimeCreateInput): Promise<Overtime>
    update(id: string, data: Prisma.OvertimeUpdateInput): Promise<Overtime>
    delete(id: string): Promise<void>
}
