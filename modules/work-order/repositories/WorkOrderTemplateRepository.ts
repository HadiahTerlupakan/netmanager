import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

export class WorkOrderTemplateRepository {
    async findItemsByTemplateId(templateId: string) {
        return prisma.workOrderTemplateItem.findMany({
            where: { templateId },
            orderBy: { order: 'asc' }
        })
    }
}
