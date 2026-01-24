import { ensureAnyPermission } from '@/lib/rbac'

// System Log section permission: use 'system_log' resource (same as menu config)
const LOG_PERMISSIONS = [
    'system_log:read'
]

export default async function LogSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensureAnyPermission(LOG_PERMISSIONS)
    return <>{children}</>
}
