import { ensurePermission } from '@/lib/rbac'

export default async function RadiusSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('network:read')
    return <>{children}</>
}
