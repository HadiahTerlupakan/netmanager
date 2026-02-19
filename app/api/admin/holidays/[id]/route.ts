import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { logger } from '@/lib/logger'

const holidayRepo = new HolidayRepository()

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('holiday:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah hari libur')
    }

    const { id } = ctx.params
    const body = await req.json()
    const { date, description, isNational } = body

    const updateData: {
        date?: Date;
        description?: string;
        isNational?: boolean;
    } = {}
    if (date) updateData.date = new Date(date)
    if (description) updateData.description = description
    if (isNational !== undefined) updateData.isNational = isNational

    const holiday = await holidayRepo.update(id, updateData)

    await logger.logActivity({
        action: 'UPDATE',
        subject: 'Holiday',
        details: { id, changes: updateData },
        userId: ctx.session!.user.id
    })

    return apiSuccess(holiday, { message: 'Hari libur berhasil diperbarui' })
})

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('holiday:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus hari libur')
    }

    const { id } = ctx.params
    await holidayRepo.delete(id)

    await logger.logActivity({
        action: 'DELETE',
        subject: 'Holiday',
        details: { id },
        userId: ctx.session!.user.id
    })

    return apiSuccess(null, { message: 'Hari libur berhasil dihapus' })
})
