import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig, getUserPermissions } from '@/lib/auth'
import { isSuperAdminRole } from '@/lib/auth-helpers'

/**
 * GET /api/user/permissions
 * Returns current user's permissions array
 */
export async function GET(_request: NextRequest) {
    try {
        const session = await getServerSession(authConfig)
        
        if (!session?.user?.id) {
            return NextResponse.json({ permissions: [] }, { status: 401 })
        }

        const user = session.user as { id: string; role?: string; isSuperAdmin?: boolean }

        // Super Admin has all permissions - return special indicator
        // Check both boolean flag (new system) and legacy role name
        if (user.isSuperAdmin || isSuperAdminRole(user.role)) {
            return NextResponse.json({
                permissions: ['*'], // Special marker for super admin
                isSuperAdmin: true
            })
        }

        const permissions = await getUserPermissions(user.id)
        
        return NextResponse.json({ 
            permissions,
            isSuperAdmin: false
        })
    } catch (error) {
        console.error('[API] Error fetching user permissions:', error)
        return NextResponse.json({ permissions: [], error: 'Failed to fetch permissions' }, { status: 500 })
    }
}
