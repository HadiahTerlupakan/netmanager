import { ensurePermission } from '@/lib/rbac'
import RestockList from './RestockList'

export const dynamic = 'force-dynamic'

export default async function RestockPage() {
    await ensurePermission('restock:read')

    return <RestockList />
}
