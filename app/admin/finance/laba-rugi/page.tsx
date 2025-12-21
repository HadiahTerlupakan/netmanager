import { ensurePermission } from '@/lib/rbac'
import { ProfitLossClient } from './ProfitLossClient'

export default async function ProfitLossPage() {
    await ensurePermission('profit_loss:read')
    return <ProfitLossClient />
}
