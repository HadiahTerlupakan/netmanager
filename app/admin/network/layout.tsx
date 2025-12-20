import { ensurePermission } from '@/lib/rbac'

export default async function NetworkSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('network:read')
    return <>{children}</>
}
