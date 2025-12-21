import { ensureAnyPermission } from '@/lib/rbac'

// FTTH section permissions
const FTTH_PERMISSIONS = [
    'ftth:read',
    'otb:read',
    'odc:read',
    'odp:read',
    'closure:read',
    'pole:read',
    'kmz:read',
    'map:read'
]

export default async function FtthSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensureAnyPermission(FTTH_PERMISSIONS)
    return <>{children}</>
}
