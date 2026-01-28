import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'

/**
 * Validation schema for assigning component to user
 */
const assignComponentSchema = z.object({
    componentId: z.string().uuid('Component ID wajib diisi'),
    amount: z.number().min(0).optional().default(0),
    notes: z.string().max(500).optional(),
})

// GET - Get user's salary components
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat komponen gaji')
        }

        const { id: userId } = await params

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
    } catch (error) {
        console.error('[API] Error fetching user components:', error)
        return ApiErrors.internalError('Gagal mengambil komponen gaji user')
    }
}

// POST - Assign component to user
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah komponen gaji')
        }

        const { id: userId } = await params
        const body = await request.json()
        
        const parseResult = assignComponentSchema.safeParse(body)
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { componentId, amount, notes } = parseResult.data

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
                data: { amount, notes, isActive: true }
            })
        } else {
            // Create new
            await prisma.userSalaryComponent.create({
                data: {
                    userId,
                    componentId,
                    amount,
                    notes
                }
            })
        }

        return apiSuccess(null, { message: 'Komponen gaji berhasil ditambahkan' })
    } catch (error) {
        console.error('[API] Error assigning component:', error)
        return ApiErrors.internalError('Gagal menambahkan komponen gaji')
    }
}
