import { prisma } from '@/lib/prisma'

export class WorkOrderTemplateRepository {
    async findItemsByTemplateId(templateId: string) {
        return prisma.workOrderTemplateItem.findMany({
            where: { templateId },
            orderBy: { order: 'asc' }
        })
    }
}
