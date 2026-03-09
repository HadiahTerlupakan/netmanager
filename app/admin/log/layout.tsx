import Link from 'next/link'

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
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2 border-b border-border pb-3">
                <Link href="/admin/log/mobile-errors" className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                    Mobile Errors
                </Link>
                <Link href="/admin/log/login" className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                    Login Logs
                </Link>
                <Link href="/admin/log/activity" className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                    Activity Logs
                </Link>
            </div>

            {children}
        </div>
    )
}
