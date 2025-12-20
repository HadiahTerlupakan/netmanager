import { ensurePermission } from '@/lib/rbac'

export default async function LogSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('system_log:read')
    return <>{children}</>
}
