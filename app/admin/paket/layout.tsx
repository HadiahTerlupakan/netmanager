import { ensurePermission } from '@/lib/rbac'

export default async function PaketSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('paket:read')
    return <>{children}</>
}
