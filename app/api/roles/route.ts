import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
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

        let whereClause: any = {}

        if (filterRestricted) {
            const { getServerSession } = await import('next-auth')
            const { authConfig } = await import('@/lib/auth')
            const session = await getServerSession(authConfig)

            if (session?.user) {
                // Get current user's role ID
                const currentUser = await prisma.user.findUnique({
                    where: { id: session.user.id },
                    select: { roleId: true, role: { select: { name: true } } }
                })

                if (currentUser?.role?.name !== 'SUPER_ADMIN') {
                    whereClause = {
                        OR: [
                            { isRestricted: false },
                            { id: currentUser?.roleId || '' }
                        ]
                    }
                }
            }
        }

        const roles = await prisma.role.findMany({
            where: whereClause,
            include: {
                _count: {
                    select: { users: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })
        return NextResponse.json(roles)
    } catch (error) {
        console.error('Error fetching roles:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!await hasPermission('roles:create')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    try {
        const body = await req.json()
        const { name, description, permissions, accessAdminPanel, accessEmployeePanel } = roleSchema.parse(body)

        // Deduplicate permissions
        const uniquePermissions = [...new Set(permissions)] as string[]

        // Parse requested permissions into resource:action pairs
        const requestedPairs = uniquePermissions.map((p) => {
            const [resource, action] = p.split(':')
            return { resource, action }
        })

        // Query database for existing permissions that match the requested pairs
        const existingPermissions = await prisma.permission.findMany({
            where: {
                OR: requestedPairs.map(pair => ({
                    resource: pair.resource,
                    action: pair.action
                }))
            },
            select: { id: true }
        })

        const role = await prisma.role.create({
            data: {
                name,
                description,
                accessAdminPanel,
                accessEmployeePanel,
                permissions: {
                    connect: existingPermissions.map((p) => ({ id: p.id })),
                },
            },
        })

        return NextResponse.json(role)
    } catch (error) {
        console.error('Error creating role:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: (error as any).errors[0].message }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
