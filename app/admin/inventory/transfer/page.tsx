import { ensurePermission } from '@/lib/rbac'
import TransferList from './TransferList'

export const dynamic = 'force-dynamic'

export default async function TransferPage() {
    await ensurePermission('transfer:read')

    return <TransferList />
}
