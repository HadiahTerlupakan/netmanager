import { ensurePermission } from '@/lib/rbac'
import KmzList from './KmzList'

export const dynamic = 'force-dynamic'

export default async function KmzPage() {
    await ensurePermission('kmz:read')

    return <KmzList />
}
