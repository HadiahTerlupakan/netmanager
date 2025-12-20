import { ensurePermission } from '@/lib/rbac'
import VlanList from './VlanList'

export const dynamic = 'force-dynamic'

export default async function VlanPage() {
    await ensurePermission('vlan:read')

    return <VlanList />
}
