import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { z } from 'zod'

const roleUpdateSchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    permissions: z.array(z.string()), // Array of permission IDs
    accessAdminPanel: z.boolean().optional(),
    accessEmployeePanel: z.boolean().optional(),
    isRestricted: z.boolean().optional()
})

// Fix for Next.js App Router params type
type Params = {
    params: Promise<{ id: string }>
}

export async function GET(req: Request, { params }: Params) {
    if (!await hasPermission('role:read')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    try {
        const role = await prisma.role.findUnique({
            where: { id },
            include: {
                permissions: true
            }
        })

        if (!role) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 })
        }

        return NextResponse.json(role)
    } catch (error) {
        console.error('Error fetching role:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PUT(req: Request, { params }: Params) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!await hasPermission('role:update')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    try {
        const body = await req.json()
        const { name, description, permissions, accessAdminPanel, accessEmployeePanel, isRestricted } = roleUpdateSchema.parse(body)

        // Don't allow modifying super admin role structure too much (safety check)
        const currentRole = await prisma.role.findUnique({ where: { id } })
        if (currentRole?.name === 'SUPER_ADMIN' && name !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Cannot rename SUPER_ADMIN role' }, { status: 400 })
        }

        const role = await prisma.role.update({
            where: { id },
            data: {
                name,
                description,
                accessAdminPanel,
                accessEmployeePanel,
                isRestricted,
                permissions: {
                    set: permissions.map(p => {
                        const [resource, action] = p.split(':')
                        return {
                            resource_action: {
                                resource,
                                action
                            }
                        }
                    })
                }
            }
        })

        return NextResponse.json(role)
    } catch (error) {
        console.error('Error updating role:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: (error as any).errors[0].message }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: Params) {
    if (!await hasPermission('role:delete')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    try {
        const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } })
        if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })

        if (role.name === 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Cannot delete SUPER_ADMIN role' }, { status: 400 })
        }

        if (role._count.users > 0) {
            return NextResponse.json({ error: 'Cannot delete role that has assigned users' }, { status: 400 })
        }

        await prisma.role.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting role:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
