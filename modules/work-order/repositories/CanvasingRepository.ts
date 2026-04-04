import { prisma } from '@/lib/prisma'

export class CanvasingRepository {
    async findByWorkOrderId(workOrderId: string) {
        return prisma.canvasing.findFirst({
            where: { workOrderId },
            select: {
                id: true,
                nama: true,
                salesId: true,
            }
        })
    }
}
