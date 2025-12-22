import AnnouncementPopup from '@/components/announcement/AnnouncementPopup'
import { ensureEmployeeAccess } from '@/lib/server-auth'

// Protected route group layout - requires authentication
export default async function ProtectedKaryawanLayout({
    children,
}: {
    children: React.ReactNode
}) {
    await ensureEmployeeAccess()

    return (
        <>
            <AnnouncementPopup portal="employee" />
            {children}
        </>
    )
}
