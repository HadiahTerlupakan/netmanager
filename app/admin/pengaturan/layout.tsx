export default async function PengaturanSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // No parent-level permission check - let each page handle its own permission
    // This allows users to access specific settings they have permission for
    return <>{children}</>
}
