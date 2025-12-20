import { ensurePermission } from '@/lib/rbac'
import ClosureList from './ClosureList'

export const dynamic = 'force-dynamic'

export default async function ClosurePage() {
    await ensurePermission('closure:read')

    return <ClosureList />
}
