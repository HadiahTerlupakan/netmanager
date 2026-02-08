import { getServerSession } from 'next-auth'
import { authOptions, isSuperAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getLeaveService } from '@/modules/attendance/services/LeaveService'
import { LeaveType, LeaveStatus } from '@prisma/client'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'

const service = getLeaveService()

/**
 * Validation schema for creating leave
 */
const createLeaveSchema = z.object({
    userId: z.string().uuid('Invalid user ID'),
    type: z.nativeEnum(LeaveType),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
    endDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
    reason: z.string().min(1, 'Alasan wajib diisi').max(500),
    attachmentUrl: z.string().url().optional().nullable(),
})

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('izin:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data izin/cuti')
        }

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        let siteId = searchParams.get('siteId')
        let departmentId = searchParams.get('departmentId')

        // Enforce RBAC Restrictions
        const user = session.user as {
            role: string;
            permissions?: string[];
            siteId?: string;
            departmentId?: string
        }
        const isSuper = isSuperAdmin(session.user as any)

        if (user.permissions?.includes('izin:site_only') && !isSuper) {
            siteId = user.siteId
        }
        if (user.permissions?.includes('izin:department_only') && !isSuper) {
            departmentId = user.departmentId
        }

        const result = await service.getLeaves({
            ...(status ? { status: status as LeaveStatus } : {}),
            ...(siteId ? { siteId } : {}),
            ...(departmentId ? { departmentId } : {})
        })

        if (!result.success) {
            return ApiErrors.internalError(result.error)
        }

        return apiSuccess(result.data?.leaves || [])
    } catch (error: unknown) {
        console.error('Error fetching leaves:', error)
        return ApiErrors.internalError('Gagal mengambil data izin/cuti')
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('izin:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat izin/cuti')
        }

        const body = await request.json()
        
        // Validate with Zod
        const parseResult = createLeaveSchema.safeParse(body)
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { userId, type, startDate, endDate, reason, attachmentUrl } = parseResult.data

        const result = await service.createLeave(
            {
                userId,
                type,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                reason,
                ...(attachmentUrl ? { attachmentUrl } : {})
            },
            session.user.id,
            true // Auto-approve for manual admin entry
        )

        if (!result.success) {
            return apiError(result.error || 'Gagal membuat izin/cuti', ErrorCodes.BUSINESS_LOGIC_ERROR, { status: 400 })
        }

        return apiSuccess(result.data, { status: 201, message: 'Izin/cuti berhasil dibuat' })
    } catch (error: unknown) {
        console.error('Error creating leave:', error)
        return ApiErrors.internalError('Gagal membuat izin/cuti')
    }
}
