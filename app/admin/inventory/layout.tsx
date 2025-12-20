import { ensurePermission } from '@/lib/rbac'

export default async function InventorySectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('inventory:read')
    return <>{children}</>
}
