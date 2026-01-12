import { ensurePermission } from '@/lib/rbac'
import SalesDashboardClient from './SalesDashboardClient'

export default async function SalesDashboardPage() {
    await ensurePermission('sales_dashboard:read')
    return <SalesDashboardClient />
}
