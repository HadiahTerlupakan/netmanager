export default async function NetworkSectionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // No parent-level permission check - let each page handle its own permission
    return <>{children}</>
}
