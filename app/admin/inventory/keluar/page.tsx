import { ensurePermission } from '@/lib/rbac'
import KeluarList from './KeluarList'

export const dynamic = 'force-dynamic'

export default async function KeluarPage() {
    await ensurePermission('keluar:read')

    return <KeluarList />
}
