import { ensureAnyPermission } from '@/lib/rbac'

// Pelanggan section permissions
const PELANGGAN_PERMISSIONS = [
    'pelanggan:read',
    'ppp:read',
    'registration:read'
]

export default async function PelangganSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensureAnyPermission(PELANGGAN_PERMISSIONS)
    return <>{children}</>
}
