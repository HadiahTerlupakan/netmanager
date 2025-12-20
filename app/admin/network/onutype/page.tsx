import { ensurePermission } from '@/lib/rbac'
import ONUTypeList from './ONUTypeList'

export const dynamic = 'force-dynamic'

export default async function ONUTypePage() {
    await ensurePermission('onutype:read')

    return <ONUTypeList />
}
