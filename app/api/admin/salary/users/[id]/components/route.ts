import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { z } from 'zod'

const assignComponentSchema = z.object({
    componentId: z.string().uuid('Component ID wajib diisi'),
    amount: z.number().min(0).optional().default(0),
    notes: z.string().max(500).optional(),
})

// GET - Get user's salary components
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('salary:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat komponen gaji')
    }

    const { id: userId } = ctx.params

    const components = await prisma.userSalaryComponent.findMany({
        where: { 
            userId,
            isActive: true
        },
        include: {
            component: true
        },
        orderBy: { component: { sortOrder: 'asc' } }
    })

    return apiSuccess({ components })
})

// POST - Assign component to user
export const POST = createHandler({ 
    auth: true, 
    schema: assignComponentSchema 
}, async (req, ctx) => {
    if (!await hasPermission('salary:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah komponen gaji')
    }

    const { id: userId } = ctx.params
    const { componentId, amount, notes } = ctx.validated

    // Check if already assigned
    const existing = await prisma.userSalaryComponent.findUnique({
        where: {
            userId_componentId: { userId, componentId }
        }
    })

    if (existing) {
        // Update existing
        await prisma.userSalaryComponent.update({
            where: { id: existing.id },
            data: { amount, notes: notes ?? null, isActive: true }
        })
    } else {
        // Create new
        await prisma.userSalaryComponent.create({
            data: {
                userId,
                componentId,
                amount,
                notes: notes ?? null
            }
        })
    }

    return apiSuccess(null, { message: 'Komponen gaji berhasil ditambahkan' })
})
