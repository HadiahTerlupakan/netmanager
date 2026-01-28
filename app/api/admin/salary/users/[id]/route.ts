import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'
import { EmployeeType, RateType } from '@prisma/client'

/**
 * Validation schema for updating user salary config
 */
const updateSalaryConfigSchema = z.object({
    basicSalary: z.union([z.number(), z.string()]).optional().nullable(),
    employeeType: z.nativeEnum(EmployeeType).optional(),
    overtimeRateNormal: z.union([z.number(), z.string()]).optional().nullable(),
    overtimeCalcTypeNormal: z.nativeEnum(RateType).optional(),
    overtimeRateHoliday: z.union([z.number(), z.string()]).optional().nullable(),
    overtimeCalcTypeHoliday: z.nativeEnum(RateType).optional(),
    overtimeRateNational: z.union([z.number(), z.string()]).optional().nullable(),
    overtimeCalcTypeNational: z.nativeEnum(RateType).optional(),
    woIncentiveRate: z.union([z.number(), z.string()]).optional().nullable(),
    lateDeductionRate: z.union([z.number(), z.string()]).optional().nullable(),
    absentDeductionRate: z.union([z.number(), z.string()]).optional().nullable(),
})

// GET - Get user salary details
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
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data gaji')
        }

        const { id: userId } = await params

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                employeeType: true,
                
                // Salary Config
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
                
                // Relations
                departments: {
                    select: { name: true }
                },
                userSalaryComponents: {
                    where: { isActive: true },
                    include: {
                        component: true
                    },
                    orderBy: { component: { type: 'asc' } }
                }
            }
        })

        if (!user) {
            return ApiErrors.notFound('User')
        }

        return apiSuccess({ user })
    } catch (error) {
        console.error('[API] Error fetching salary user detail:', error)
        return ApiErrors.internalError('Gagal mengambil detail gaji user')
    }
}

// PUT - Update user salary config
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah konfigurasi gaji')
        }

        const { id } = await params
        const body = await request.json()
        
        const parseResult = updateSalaryConfigSchema.safeParse(body)
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const {
            basicSalary,
            employeeType,
            overtimeRateNormal, overtimeCalcTypeNormal,
            overtimeRateHoliday, overtimeCalcTypeHoliday,
            overtimeRateNational, overtimeCalcTypeNational,
            woIncentiveRate,
            lateDeductionRate,
            absentDeductionRate
        } = parseResult.data

        await prisma.user.update({
            where: { id },
            data: {
                employeeType,
                basicSalary: basicSalary ? parseFloat(String(basicSalary)) : null,
                overtimeRateNormal: overtimeRateNormal ? parseFloat(String(overtimeRateNormal)) : null,
                overtimeCalcTypeNormal,
                overtimeRateHoliday: overtimeRateHoliday ? parseFloat(String(overtimeRateHoliday)) : null,
                overtimeCalcTypeHoliday,
                overtimeRateNational: overtimeRateNational ? parseFloat(String(overtimeRateNational)) : null,
                overtimeCalcTypeNational,
                woIncentiveRate: woIncentiveRate ? parseFloat(String(woIncentiveRate)) : null,
                lateDeductionRate: lateDeductionRate ? parseFloat(String(lateDeductionRate)) : null,
                absentDeductionRate: absentDeductionRate ? parseFloat(String(absentDeductionRate)) : null,
            }
        })

        return apiSuccess(null, { message: 'Konfigurasi gaji berhasil diperbarui' })
    } catch (error) {
        console.error('[API] Error updating user salary config:', error)
        return ApiErrors.internalError('Gagal memperbarui konfigurasi gaji')
    }
}

// DELETE - Remove user from salary list
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus dari penggajian')
        }

        const { id } = await params

        await prisma.user.update({
            where: { id },
            data: { basicSalary: null }
        })

        return apiSuccess(null, { message: 'User berhasil dihapus dari daftar gaji' })
    } catch (error) {
        console.error('[API] Error removing salary user:', error)
        return ApiErrors.internalError('Gagal menghapus user dari penggajian')
    }
}
