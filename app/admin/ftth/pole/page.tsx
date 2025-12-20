import { ensurePermission } from '@/lib/rbac'
import PoleList from './PoleList'

export const dynamic = 'force-dynamic'

export default async function PolePage() {
    await ensurePermission('pole:read')

    return <PoleList />
}
