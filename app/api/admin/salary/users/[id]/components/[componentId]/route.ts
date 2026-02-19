import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

// DELETE - Remove component from user
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('salary:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus komponen gaji')
    }

    const { componentId } = ctx.params

    await prisma.userSalaryComponent.delete({
        where: { id: componentId }
    })

    return apiSuccess(null, { message: 'Komponen gaji berhasil dihapus' })
})
