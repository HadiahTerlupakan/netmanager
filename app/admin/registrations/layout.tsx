import { ensurePermission } from '@/lib/rbac'

export default async function RegistrationsSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('pelanggan:read')
    return <>{children}</>
}
