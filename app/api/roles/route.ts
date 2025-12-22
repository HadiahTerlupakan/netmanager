import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authConfig } from "@/lib/auth"
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { getRoleService } from '@/modules/roles'
import { z } from 'zod'

const roleSchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    permissions: z.array(z.string()), // Array of permission IDs
    accessAdminPanel: z.boolean().optional().default(false),
    accessEmployeePanel: z.boolean().optional().default(false),
    isRestricted: z.boolean().optional().default(false)
})

export async function GET(req: Request) {
    // Allow access if user has roles:read OR users:create OR users:update permission
    // This enables users who manage users to see the role dropdown
    const canReadRoles = await hasPermission('roles:read')
    const canCreateUsers = await hasPermission('users:create')
    const canUpdateUsers = await hasPermission('users:update')

    if (!canReadRoles && !canCreateUsers && !canUpdateUsers) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const filterRestricted = searchParams.get('filterRestricted') === 'true'

        const roleService = getRoleService()

        if (filterRestricted) {
            const session = await getServerSession(authConfig)

            if (session?.user) {
                // Get current user's role info
                const currentUser = await prisma.user.findUnique({
                    where: { id: session.user.id },
                    select: { roleId: true, role: { select: { name: true } } }
                })

                console.log('[Roles API] Current user role:', currentUser?.role?.name)

                const roles = await roleService.getAllRoles({
                    filterRestricted: true,
                    currentUserRoleId: currentUser?.roleId,
                    currentUserRoleName: currentUser?.role?.name
                })

                return NextResponse.json(roles)
            } else {
                // No session - show only non-restricted roles
                const roles = await roleService.getAllRoles({
                    filterRestricted: true,
                    currentUserRoleName: null
                })
                return NextResponse.json(roles)
            }
        }

        // No filter - return all roles
        const roles = await roleService.getAllRoles()
        return NextResponse.json(roles)
    } catch (error) {
        console.error('Error fetching roles:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    if (!await hasPermission('roles:create')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    try {
        const body = await req.json()
        const validated = roleSchema.parse(body)

        const roleService = getRoleService()
        const newRole = await roleService.createRole({
            name: validated.name,
            description: validated.description,
            permissions: validated.permissions,
            accessAdminPanel: validated.accessAdminPanel,
            accessEmployeePanel: validated.accessEmployeePanel,
            isRestricted: validated.isRestricted
        })

        return NextResponse.json(newRole)
    } catch (error) {
        console.error('Error creating role:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
        }
        if (error instanceof Error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
