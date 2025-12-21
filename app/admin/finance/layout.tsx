export default async function FinanceSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // No parent-level permission check - let each page handle its own permission
    // This allows users to access specific finance pages they have permission for
    return <>{children}</>
}
