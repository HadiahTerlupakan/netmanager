import { ensurePermission } from '@/lib/rbac'

export default async function AnnouncementSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('announcement:read')
    return <>{children}</>
}
