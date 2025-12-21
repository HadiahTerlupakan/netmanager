import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './ProfitLossClient'

export default async function Page() {
    await ensurePermission('profit_loss:read')
    return <ClientComponent />
}
