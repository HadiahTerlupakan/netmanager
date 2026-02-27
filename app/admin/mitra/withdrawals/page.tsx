import { ensurePermission } from '@/lib/rbac'
import WithdrawalsClient from './WithdrawalsClient'

export const dynamic = 'force-dynamic'

export default async function WithdrawalsPage() {
    await ensurePermission('users:read')
    return <WithdrawalsClient />
}
