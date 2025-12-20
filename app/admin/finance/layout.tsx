import { ensurePermission } from '@/lib/rbac'

export default async function FinanceSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('finance:read')
    return <>{children}</>
}
