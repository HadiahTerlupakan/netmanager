import { ensurePermission } from '@/lib/rbac'
import MasukList from './MasukList'

export const dynamic = 'force-dynamic'

export default async function MasukPage() {
    await ensurePermission('masuk:read')

    return <MasukList />
}
