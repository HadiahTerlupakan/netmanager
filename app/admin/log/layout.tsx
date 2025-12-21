import { ensureAnyPermission } from '@/lib/rbac'

// System Log section permissions
const LOG_PERMISSIONS = [
    'system_log:read',
    'login:read',
    'activity:read'
]

export default async function LogSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensureAnyPermission(LOG_PERMISSIONS)
    return <>{children}</>
}
