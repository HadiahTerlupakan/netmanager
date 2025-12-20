import { ensurePermission } from '@/lib/rbac'

export default async function SettingsSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('pengaturan:read')
    return <>{children}</>
}
