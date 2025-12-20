import { ensurePermission } from '@/lib/rbac'
import OdpList from './OdpList'

export const dynamic = 'force-dynamic'

export default async function OdpPage() {
    await ensurePermission('odp:read')

    return <OdpList />
}
