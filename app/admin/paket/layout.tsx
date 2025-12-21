import { ensureAnyPermission } from '@/lib/rbac'

// Paket section permissions
const PAKET_PERMISSIONS = [
    'paket:read',
    'bandwidth:read',
    'profileppp:read',
    'harga:read'
]

export default async function PaketSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensureAnyPermission(PAKET_PERMISSIONS)
    return <>{children}</>
}
