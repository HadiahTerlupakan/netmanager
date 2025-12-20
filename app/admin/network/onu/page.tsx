import { ensurePermission } from '@/lib/rbac'
import ONUList from './ONUList'

export const dynamic = 'force-dynamic'

export default async function ONUPage() {
    await ensurePermission('onu:read')

    return <ONUList />
}
