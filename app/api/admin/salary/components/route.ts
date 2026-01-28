import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalaryComponentRepository } from '@/modules/salary/repositories/SalaryComponentRepository'
import { SalaryComponentType } from '@prisma/client'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'

const componentRepo = new SalaryComponentRepository()

/**
 * Validation schemas
 */
const createComponentSchema = z.object({
    action: z.enum(['assign', 'create']).optional(),
    // For assign action
    userId: z.string().uuid().optional(),
    componentId: z.string().uuid().optional(),
    amount: z.number().optional(),
    notes: z.string().max(500).optional(),
    // For create action
    name: z.string().min(1).max(100).optional(),
    type: z.nativeEnum(SalaryComponentType).optional(),
    rateType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
    defaultAmount: z.number().optional(),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int().optional(),
})

const updateComponentSchema = z.object({
    id: z.string().uuid('ID komponen wajib diisi'),
    name: z.string().min(1).max(100).optional(),
    type: z.nativeEnum(SalaryComponentType).optional(),
    rateType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
    defaultAmount: z.number().optional(),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
})

/**
 * GET /api/admin/salary/components - List all components
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat komponen gaji')
        }

        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') as SalaryComponentType | undefined
        const userId = searchParams.get('userId')

        const components = await componentRepo.findAll(type)

        // If userId specified, include user's component values
        let userComponents = null
        if (userId) {
            userComponents = await componentRepo.getUserComponents(userId)
        }

        return apiSuccess({ components, userComponents })
    } catch (error) {
        console.error('Error fetching components:', error)
        return ApiErrors.internalError('Gagal mengambil data komponen gaji')
    }
}

/**
 * POST /api/admin/salary/components - Create component or assign to user
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat komponen gaji')
        }

        const body = await request.json()
        const parseResult = createComponentSchema.safeParse(body)
        
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { action, userId, componentId, amount, notes, name, type, rateType, defaultAmount, description, sortOrder } = parseResult.data

        if (action === 'assign') {
            if (!userId || !componentId || amount === undefined) {
                return apiError('userId, componentId, dan amount wajib diisi', ErrorCodes.MISSING_FIELD, { status: 400 })
            }

            const userComponent = await componentRepo.assignToUser(userId, componentId, amount, notes)
            return apiSuccess({ userComponent }, { message: 'Komponen berhasil ditambahkan ke user' })
        } else {
            if (!name || !type) {
                return apiError('name dan type wajib diisi', ErrorCodes.MISSING_FIELD, { status: 400 })
            }

            // Check if component with same name already exists
            const existingComponent = await componentRepo.findByName(name)
            
            let component;
            if (existingComponent) {
                const reqRateType = rateType || 'FIXED'
                if (existingComponent.type !== type) {
                    return ApiErrors.conflict(`Komponen "${name}" sudah ada dengan tipe berbeda (${existingComponent.type})`)
                }
                if (existingComponent.rateType !== reqRateType) {
                    return ApiErrors.conflict(`Komponen "${name}" sudah ada dengan tipe rate berbeda (${existingComponent.rateType})`)
                }
                component = existingComponent
            } else {
                component = await componentRepo.create({
                    name,
                    type,
                    rateType: rateType || 'FIXED',
                    defaultAmount,
                    description,
                    sortOrder: sortOrder || 0
                })
            }

            return apiSuccess({ component }, { status: 201, message: 'Komponen berhasil dibuat' })
        }
    } catch (error) {
        console.error('Error creating component:', error)
        return ApiErrors.internalError('Gagal membuat komponen gaji')
    }
}

/**
 * PUT /api/admin/salary/components - Update component
 */
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah komponen gaji')
        }

        const body = await request.json()
        const parseResult = updateComponentSchema.safeParse(body)
        
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { id, ...updateData } = parseResult.data
        const component = await componentRepo.update(id, updateData)

        return apiSuccess({ component }, { message: 'Komponen berhasil diperbarui' })
    } catch (error) {
        console.error('Error updating component:', error)
        return ApiErrors.internalError('Gagal memperbarui komponen gaji')
    }
}

/**
 * DELETE /api/admin/salary/components - Delete component or remove from user
 */
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus komponen gaji')
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        const userId = searchParams.get('userId')
        const componentId = searchParams.get('componentId')

        if (userId && componentId) {
            // Remove component from user
            await componentRepo.removeFromUser(userId, componentId)
            return apiSuccess(null, { message: 'Komponen berhasil dihapus dari user' })
        } else if (id) {
            // Delete component
            await componentRepo.delete(id)
            return apiSuccess(null, { message: 'Komponen berhasil dihapus' })
        } else {
            return apiError('id atau (userId + componentId) wajib diisi', ErrorCodes.MISSING_FIELD, { status: 400 })
        }
    } catch (error) {
        console.error('Error deleting component:', error)
        return ApiErrors.internalError('Gagal menghapus komponen gaji')
    }
}
