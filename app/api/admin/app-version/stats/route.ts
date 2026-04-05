import { ensurePermission } from '@/lib/rbac'
import { apiSuccess, createHandler } from '@/lib/api'
import { getAppVersionService } from '@/modules/app-version'

export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
    await ensurePermission('app_version:read')

    const service = getAppVersionService()
    return apiSuccess(await service.getStats())
})
