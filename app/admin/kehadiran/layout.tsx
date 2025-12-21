import { ensureAnyPermission } from '@/lib/rbac'

// Kehadiran section permissions
const KEHADIRAN_PERMISSIONS = [
    'kehadiran:read',
    'attendance:read',
    'report:read',
    'lembur:read'
]

export default async function KehadiranSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensureAnyPermission(KEHADIRAN_PERMISSIONS)
    return <>{children}</>
}
