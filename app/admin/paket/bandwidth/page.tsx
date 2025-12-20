import { ensurePermission } from '@/lib/rbac'
import BandwidthList from './BandwidthList'

export const dynamic = 'force-dynamic'

export default async function BandwidthPage() {
    await ensurePermission('bandwidth:read')

    return <BandwidthList />
}
