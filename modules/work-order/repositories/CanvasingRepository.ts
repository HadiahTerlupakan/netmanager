import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

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
