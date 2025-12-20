import { ensurePermission } from '@/lib/rbac'

export default async function WorkOrdersSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('workorders:read')
    return <>{children}</>
}
