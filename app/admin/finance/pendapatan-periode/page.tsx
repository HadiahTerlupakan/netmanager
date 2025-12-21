import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PeriodIncomeClient'

export default async function PeriodIncomePage() {
    await ensurePermission('period_income:read')
    return <PeriodIncomeClient />
}
