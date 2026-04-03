import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

export class PermissionRepository {
    async findByResourceAndAction(resource: string, action: string) {
        return prisma.permission.findFirst({
            where: { resource, action }
        })
    }

    async findManyByResourceActionPairs(pairs: { resource: string; action: string }[]) {
        return prisma.permission.findMany({
            where: {
                OR: pairs.map(pair => ({
                    resource: pair.resource,
                    action: pair.action
                }))
            },
            select: {
                id: true,
                resource: true,
                action: true
            }
        })
    }

    async findManyByResourceAction(pairs: { resource: string; action: string }[]): Promise<{ id: string }[]> {
        return prisma.permission.findMany({
            where: {
                OR: pairs.map(pair => ({
                    resource: pair.resource,
                    action: pair.action
                }))
            },
            select: {
                id: true
            }
        })
    }

    async findOrCreateMany(pairs: Array<{ resource: string; action: string }>): Promise<void> {
        if (pairs.length === 0) return

        const existingPermissions = await prisma.permission.findMany({
            where: {
                OR: pairs.map(pair => ({
                    resource: pair.resource,
                    action: pair.action
                }))
            },
            select: {
                resource: true,
                action: true
            }
        })

        const missingPermissions = pairs.filter(req =>
            !existingPermissions.some(exist =>
                exist.resource === req.resource && exist.action === req.action
            )
        )

        if (missingPermissions.length > 0) {
            await prisma.permission.createMany({
                data: missingPermissions.map(p => ({
                    id: randomUUID(),
                    resource: p.resource,
                    action: p.action,
                    name: `${p.action.charAt(0).toUpperCase() + p.action.slice(1)} ${p.resource.charAt(0).toUpperCase() + p.resource.slice(1)}`,
                    description: `Izinkan ${p.action} pada ${p.resource}`,
                    updatedAt: new Date()
                })),
                skipDuplicates: true
            })
        }
    }

    async createMany(permissions: { id: string; resource: string; action: string; name: string; description: string; updatedAt: Date }[]) {
        return prisma.permission.createMany({
            data: permissions,
            skipDuplicates: true
        })
    }
}
