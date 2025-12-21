import { ensureAnyPermission } from '@/lib/rbac'

// Inventory section permissions
const INVENTORY_PERMISSIONS = [
    'inventory:read',
    'barang:read',
    'masuk:read',
    'keluar:read',
    'transfer:read',
    'restock:read',
    'opname:read',
    'gudang:read'
]

export default async function InventorySectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensureAnyPermission(INVENTORY_PERMISSIONS)
    return <>{children}</>
}
