import { prisma } from '@/lib/prisma'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET() {
    try {
        const [sites, departments] = await Promise.all([
            prisma.sites.findMany({
                where: { isActive: true },
                select: { id: true, name: true }
            }),
            prisma.departments.findMany({
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            })
        ])

        return apiSuccess({ sites, departments })
    } catch (error) {
        console.error('Error fetching options:', error)
        return ApiErrors.internalError('Gagal mengambil data opsi')
    }
}
