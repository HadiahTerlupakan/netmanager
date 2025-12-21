import { ensureAnyPermission } from '@/lib/rbac'

// Finance section permissions: daily_income, period_income, expense, profit_loss
const FINANCE_PERMISSIONS = [
    'daily_income:read',
    'period_income:read',
    'expense:read',
    'profit_loss:read'
]

export default async function FinanceSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensureAnyPermission(FINANCE_PERMISSIONS)
    return <>{children}</>
}
