import { ensurePermission } from '@/lib/rbac'
import RadiusDashboard from './RadiusDashboard'

export const dynamic = 'force-dynamic'

export default async function RadiusPage() {
    await ensurePermission('radius:read')

    return <RadiusDashboard />
}
