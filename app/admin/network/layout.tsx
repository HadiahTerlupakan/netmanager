import { ensureAnyPermission } from '@/lib/rbac'

// Network section permissions
const NETWORK_PERMISSIONS = [
    'network:read',
    'mikrotik:read',
    'radius:read',
    'olt:read',
    'onu:read',
    'onutype:read',
    'speedprofiles:read',
    'vlan:read'
]

export default async function NetworkSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensureAnyPermission(NETWORK_PERMISSIONS)
    return <>{children}</>
}
