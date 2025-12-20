import { ensurePermission } from '@/lib/rbac'
import MikroTikRouterList from './MikroTikRouterList'

export const dynamic = 'force-dynamic'

export default async function MikroTikPage() {
    await ensurePermission('mikrotik:read')

    return <MikroTikRouterList />
}
