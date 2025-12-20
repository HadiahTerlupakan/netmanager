import { ensurePermission } from '@/lib/rbac'

export default async function AttendanceSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('attendance:read')
    return <>{children}</>
}
