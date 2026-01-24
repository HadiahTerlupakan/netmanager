import { ensureAnyPermission } from '@/lib/rbac'

// Finance section permission: use 'finance' resource (same as menu config)
const FINANCE_PERMISSIONS = [
    'finance:read'
]

export default async function FinanceSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensureAnyPermission(FINANCE_PERMISSIONS)
    return <>{children}</>
}
