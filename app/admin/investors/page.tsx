import { ensurePermission } from '@/lib/rbac'
import InvestorsClient from './InvestorsClient'

export const dynamic = 'force-dynamic'

export default async function InvestorsPage() {
    await ensurePermission('investors:read') // we can use users:read or create a specific investors:read later
    return <InvestorsClient />
}
