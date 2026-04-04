import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import * as z from 'zod'
import { EmployeeType, RateType, PtkpStatus } from '@prisma/client'

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
    joinDate: z.string().optional().nullable(),
    ptkpStatus: z.nativeEnum(PtkpStatus).optional().nullable(),
    bpjsKesehatan: z.boolean().optional(),
    bpjsKetenagakerjaan: z.boolean().optional(),
})

// GET - Get user salary details
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('salary:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data gaji')
    }

    const { id: userId } = ctx.params

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
            joinDate: true,
            ptkpStatus: true,
            bpjsKesehatan: true,
            bpjsKetenagakerjaan: true,

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
})

// PUT - Update user salary config
export const PUT = createHandler({
    auth: true,
    schema: updateSalaryConfigSchema
}, async (req, ctx) => {
    if (!await hasPermission('salary:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah konfigurasi gaji')
    }

    const { id } = ctx.params
    const {
        basicSalary,
        employeeType,
        overtimeRateNormal, overtimeCalcTypeNormal,
        overtimeRateHoliday, overtimeCalcTypeHoliday,
        overtimeRateNational, overtimeCalcTypeNational,
        woIncentiveRate,
        lateDeductionRate,
        absentDeductionRate,
        joinDate,
        ptkpStatus,
        bpjsKesehatan,
        bpjsKetenagakerjaan
    } = ctx.validated

    await prisma.user.update({
        where: { id },
        data: {
            ...(employeeType ? { employeeType } : {}),
            ...(basicSalary !== undefined ? { basicSalary: basicSalary ? parseFloat(String(basicSalary)) : null } : {}),
            ...(overtimeRateNormal !== undefined ? { overtimeRateNormal: overtimeRateNormal ? parseFloat(String(overtimeRateNormal)) : null } : {}),
            ...(overtimeCalcTypeNormal !== undefined ? { overtimeCalcTypeNormal } : {}),
            ...(overtimeRateHoliday !== undefined ? { overtimeRateHoliday: overtimeRateHoliday ? parseFloat(String(overtimeRateHoliday)) : null } : {}),
            ...(overtimeCalcTypeHoliday !== undefined ? { overtimeCalcTypeHoliday } : {}),
            ...(overtimeRateNational !== undefined ? { overtimeRateNational: overtimeRateNational ? parseFloat(String(overtimeRateNational)) : null } : {}),
            ...(overtimeCalcTypeNational !== undefined ? { overtimeCalcTypeNational } : {}),
            ...(woIncentiveRate !== undefined ? { woIncentiveRate: woIncentiveRate ? parseFloat(String(woIncentiveRate)) : null } : {}),
            ...(lateDeductionRate !== undefined ? { lateDeductionRate: lateDeductionRate ? parseFloat(String(lateDeductionRate)) : null } : {}),
            ...(absentDeductionRate !== undefined ? { absentDeductionRate: absentDeductionRate ? parseFloat(String(absentDeductionRate)) : null } : {}),
            ...(joinDate !== undefined ? { joinDate: joinDate ? new Date(joinDate) : null } : {}),
            ...(ptkpStatus !== undefined ? { ptkpStatus } : {}),
            ...(bpjsKesehatan !== undefined ? { bpjsKesehatan } : {}),
            ...(bpjsKetenagakerjaan !== undefined ? { bpjsKetenagakerjaan } : {}),
        }
    })

    return apiSuccess(null, { message: 'Konfigurasi gaji berhasil diperbarui' })
})

// DELETE - Remove user from salary list
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('salary:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus dari penggajian')
    }

    const { id } = ctx.params

    await prisma.user.update({
        where: { id },
        data: { basicSalary: null }
    })

    return apiSuccess(null, { message: 'User berhasil dihapus dari daftar gaji' })
})
