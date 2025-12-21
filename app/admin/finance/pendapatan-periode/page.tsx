import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PeriodIncomeClient'

export default async function Page() {
    await ensurePermission('period_income:read')
    return <ClientComponent />
}
