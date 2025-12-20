import { ensurePermission } from '@/lib/rbac'
import DailyRevenueList from './DailyRevenueList'

export const dynamic = 'force-dynamic'

export default async function DailyRevenuePage() {
    await ensurePermission('daily_income:read')

    return <DailyRevenueList />
}
