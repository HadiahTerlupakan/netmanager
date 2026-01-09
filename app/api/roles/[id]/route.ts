import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasPermission } from '@/lib/rbac'
import { getRoleService } from '@/modules/roles'
import { z } from 'zod'

const roleUpdateSchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    permissions: z.array(z.string()), // Array of permission IDs
    accessAdminPanel: z.boolean().optional(),
    accessEmployeePanel: z.boolean().optional(),
    isRestricted: z.boolean().optional(),
    isTechnical: z.boolean().optional()
})

// Fix for Next.js App Router params type
type Params = {
    params: Promise<{ id: string }>
}

export async function GET(req: Request, { params }: Params) {
    if (!await hasPermission('roles:read')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    try {
        const roleService = getRoleService()
        const role = await roleService.getRoleWithPermissions(id)

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

    if (!await hasPermission('roles:update')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    try {
        const body = await req.json()
        const validated = roleUpdateSchema.parse(body)

        const roleService = getRoleService()
        const updatedRole = await roleService.updateRole(id, {
            name: validated.name,
            description: validated.description,
            permissions: validated.permissions,
            accessAdminPanel: validated.accessAdminPanel,
            accessEmployeePanel: validated.accessEmployeePanel,
            isRestricted: validated.isRestricted,
            isTechnical: validated.isTechnical
        })

        return NextResponse.json(updatedRole)
    } catch (error) {
        console.error('Error updating role:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
        }
        if (error instanceof Error) {
            if (error.message === 'Role not found') {
                return NextResponse.json({ error: error.message }, { status: 404 })
            }
            if (error.message === 'Cannot rename SUPER_ADMIN role') {
                return NextResponse.json({ error: error.message }, { status: 400 })
            }
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: Params) {
    if (!await hasPermission('roles:delete')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    try {
        const roleService = getRoleService()
        await roleService.deleteRole(id)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting role:', error)
        if (error instanceof Error) {
            if (error.message === 'Role not found') {
                return NextResponse.json({ error: error.message }, { status: 404 })
            }
            if (error.message === 'Cannot delete SUPER_ADMIN role' ||
                error.message === 'Cannot delete role that has assigned users') {
                return NextResponse.json({ error: error.message }, { status: 400 })
            }
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
