import { ensurePermission } from '@/lib/rbac'

export default async function LemburSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensurePermission('attendance:read')
    return <>{children}</>
}
