import { ensurePermission } from '@/lib/rbac'
import OdcList from './OdcList'

export const dynamic = 'force-dynamic'

export default async function OdcPage() {
    await ensurePermission('odc:read')

    return <OdcList />
}
