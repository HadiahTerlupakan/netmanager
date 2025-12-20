import { ensurePermission } from '@/lib/rbac'
import OLTList from './OLTList'

export const dynamic = 'force-dynamic'

export default async function OLTPage() {
    await ensurePermission('olt:read')

    return <OLTList />
}
