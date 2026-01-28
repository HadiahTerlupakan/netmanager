import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

// DELETE - Remove component from user
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; componentId: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('salary:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus komponen gaji')
        }

        const { componentId } = await params

        await prisma.userSalaryComponent.delete({
            where: { id: componentId }
        })

        return apiSuccess(null, { message: 'Komponen gaji berhasil dihapus' })
    } catch (error) {
        console.error('[API] Error removing component:', error)
        return ApiErrors.internalError('Gagal menghapus komponen gaji')
    }
}
