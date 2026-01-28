import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'
import { EmployeeType, RateType } from '@prisma/client'

/**
 * Validation schema for adding user to salary list
 */
const addSalaryUserSchema = z.object({
    userId: z.string().uuid('User ID wajib diisi'),
    basicSalary: z.number().min(0).optional().default(0),
    employeeType: z.nativeEnum(EmployeeType).optional().default('KARYAWAN'),
    overtimeRateNormal: z.number().min(0).optional(),
    overtimeCalcTypeNormal: z.nativeEnum(RateType).optional().default('PER_HOUR'),
    overtimeRateHoliday: z.number().min(0).optional(),
    overtimeCalcTypeHoliday: z.nativeEnum(RateType).optional().default('PER_HOUR'),
    overtimeRateNational: z.number().min(0).optional(),
    overtimeCalcTypeNational: z.nativeEnum(RateType).optional().default('PER_HOUR'),
    woIncentiveRate: z.number().min(0).optional(),
    lateDeductionRate: z.number().min(0).optional(),
    absentDeductionRate: z.number().min(0).optional(),
})

// GET - List users with salary setup
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data gaji')
        }

        // Get users with basicSalary set (already in salary list)
        const users = await prisma.user.findMany({
            where: {
                basicSalary: { not: null },
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
                employeeType: true,
                basicSalary: true,
                overtimeRateNormal: true,
                overtimeCalcTypeNormal: true,
                overtimeRateHoliday: true,
                overtimeCalcTypeHoliday: true,
                overtimeRateNational: true,
                overtimeCalcTypeNational: true,
                woIncentiveRate: true,
                lateDeductionRate: true,
                absentDeductionRate: true,
                departments: {
                    select: { name: true }
                },
                role: {
                    select: { name: true }
                }
            },
            orderBy: { name: 'asc' }
        })

        // Get all active users for dropdown
        const allUsers = await prisma.user.findMany({
            where: {
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
                employeeType: true,
                basicSalary: true,
            },
            orderBy: { name: 'asc' }
        })

        return apiSuccess({ users, allUsers })
    } catch (error) {
        console.error('[API] Error fetching salary users:', error)
        return ApiErrors.internalError('Gagal mengambil data pengguna')
    }
}

// POST - Add user to salary list (set basicSalary and config)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menambah user ke penggajian')
        }

        const body = await request.json()
        const parseResult = addSalaryUserSchema.safeParse(body)
        
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const {
            userId,
            basicSalary,
            employeeType,
            overtimeRateNormal,
            overtimeCalcTypeNormal,
            overtimeRateHoliday,
            overtimeCalcTypeHoliday,
            overtimeRateNational,
            overtimeCalcTypeNational,
            woIncentiveRate,
            lateDeductionRate,
            absentDeductionRate,
        } = parseResult.data

        await prisma.user.update({
            where: { id: userId },
            data: {
                basicSalary,
                employeeType,
                overtimeRateNormal,
                overtimeCalcTypeNormal,
                overtimeRateHoliday,
                overtimeCalcTypeHoliday,
                overtimeRateNational,
                overtimeCalcTypeNational,
                woIncentiveRate,
                lateDeductionRate,
                absentDeductionRate,
            }
        })

        return apiSuccess(null, { message: 'User berhasil ditambahkan ke daftar gaji' })
    } catch (error) {
        console.error('[API] Error adding salary user:', error)
        return ApiErrors.internalError('Gagal menambahkan user ke penggajian')
    }
}
