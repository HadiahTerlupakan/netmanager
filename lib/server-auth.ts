import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function ensureEmployeeAccess(permission?: string) {
    const session = await getServerSession(authOptions)

    // 1. Check authentication
    if (!session || !session.user) {
        redirect('/karyawan/login')
    }

    // 2. Check Employee Portal Access
    const user = session.user as any
    // SUPER_ADMIN bypass
    if (user.role === 'SUPER_ADMIN') {
        return user
    }

    if (!user.accessEmployeePanel) {
        // If logged in but no access to portal, redirect to error or login with error
        redirect('/karyawan/login?error=AccessDenied')
    }

    // 3. Check Specific Permission
    if (permission) {
        const userPermissions = (user.permissions as string[]) || []
        const hasPermission = userPermissions.includes(permission)

        if (!hasPermission) {
            // Redirect to dashboard with unauthorized error if trying to access restricted page
            // If already on dashboard, maybe just return null? But this function is for page protection.
            redirect('/karyawan/dashboard?error=Unauthorized')
        }
    }

    return user
}
