import { ensurePermission } from '@/lib/rbac'

export default async function PengaturanSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('pengaturan:read')
    return <>{children}</>
}
