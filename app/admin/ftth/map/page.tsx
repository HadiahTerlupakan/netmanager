import { ensurePermission } from '@/lib/rbac'
import FtthMap from './FtthMap'

export const dynamic = 'force-dynamic'

export default async function FtthMapPage() {
    await ensurePermission('map:read')

    return <FtthMap />
}
