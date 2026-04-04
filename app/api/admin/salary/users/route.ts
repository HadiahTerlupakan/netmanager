import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import * as z from 'zod'
import { EmployeeType, RateType, PtkpStatus } from '@prisma/client'

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
    joinDate: z.string().optional().nullable(),
    ptkpStatus: z.nativeEnum(PtkpStatus).optional().nullable(),
    bpjsKesehatan: z.boolean().optional(),
    bpjsKetenagakerjaan: z.boolean().optional(),
})

// GET - List users with salary setup
export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
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
            joinDate: true,
            ptkpStatus: true,
            bpjsKesehatan: true,
            bpjsKetenagakerjaan: true,
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
})

// POST - Add user to salary list (set basicSalary and config)
export const POST = createHandler({
    auth: true,
    schema: addSalaryUserSchema
}, async (req, ctx) => {
    if (!await hasPermission('salary:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menambah user ke penggajian')
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
        joinDate,
        ptkpStatus,
        bpjsKesehatan,
        bpjsKetenagakerjaan
    } = ctx.validated

    await prisma.user.update({
        where: { id: userId },
        data: {
            basicSalary,
            employeeType,
            overtimeCalcTypeNormal,
            overtimeCalcTypeHoliday,
            overtimeCalcTypeNational,

            ...(overtimeRateNormal !== undefined ? { overtimeRateNormal } : {}),
            ...(overtimeRateHoliday !== undefined ? { overtimeRateHoliday } : {}),
            ...(overtimeRateNational !== undefined ? { overtimeRateNational } : {}),
            ...(woIncentiveRate !== undefined ? { woIncentiveRate } : {}),
            ...(lateDeductionRate !== undefined ? { lateDeductionRate } : {}),
            ...(absentDeductionRate !== undefined ? { absentDeductionRate } : {}),
            ...(joinDate !== undefined ? { joinDate: joinDate ? new Date(joinDate) : null } : {}),
            ...(ptkpStatus !== undefined ? { ptkpStatus } : {}),
            ...(bpjsKesehatan !== undefined ? { bpjsKesehatan } : {}),
            ...(bpjsKetenagakerjaan !== undefined ? { bpjsKetenagakerjaan } : {}),
        }
    })

    return apiSuccess(null, { message: 'User berhasil ditambahkan ke daftar gaji' })
})
