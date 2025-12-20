import { ensurePermission } from '@/lib/rbac'

export default async function FtthSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('ftth:read')
    return <>{children}</>
}
