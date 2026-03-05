import { ensureAnyPermission } from '@/lib/rbac'

// Pengaturan section permissions
const PENGATURAN_PERMISSIONS = [
    'pengaturan:read',
    'umum:read',
    'logo:read',
    'email:read',
    'whatsapp:read',
    'payment_gateway:read',
    'api:read',
    'backup_database:read'
]

export default async function PengaturanSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensureAnyPermission(PENGATURAN_PERMISSIONS)
    return <>{children}</>
}
