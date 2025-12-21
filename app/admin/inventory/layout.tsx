export default async function InventorySectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // No parent-level permission check - let each page handle its own permission
    return <>{children}</>
}
