import { ensurePermission } from '@/lib/rbac'

export default async function PelangganSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('pelanggan:read')
    return <>{children}</>
}
