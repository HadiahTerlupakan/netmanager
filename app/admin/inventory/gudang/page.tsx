import { ensurePermission } from '@/lib/rbac'
import GudangList from './GudangList'

export const dynamic = 'force-dynamic'

export default async function GudangPage() {
    await ensurePermission('gudang:read')

    return <GudangList />
}
