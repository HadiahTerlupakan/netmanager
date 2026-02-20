import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasPermission } from '@/lib/rbac'
import { getRoleService } from '@/modules/roles'
import { z } from 'zod'
import { logActivitySafe } from '@/lib/logger'
import { sanitizePermissionsByPanelAccess } from '@/lib/permission-sanitizer'

const roleUpdateSchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    permissions: z.array(z.string()), // Array of permission IDs
    accessAdminPanel: z.boolean().optional(),
    accessEmployeePanel: z.boolean().optional(),
    isRestricted: z.boolean().optional(),
    isTechnical: z.boolean().optional(),
    isSuperAdmin: z.boolean().optional()
})

// Fix for Next.js App Router params type
type Params = {
    params: Promise<{ id: string }>
}

export async function GET(req: Request, { params }: Params) {
    if (!await hasPermission('roles:read')) {
        return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 403 })
    }

    const { id } = await params

    try {
        const roleService = getRoleService()
        const role = await roleService.getRoleWithPermissions(id)

        if (!role) {
            return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 })
        }

        return NextResponse.json(role)
    } catch (error) {
        console.error('Error fetching role:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}

export async function PUT(req: Request, { params }: Params) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    if (!await hasPermission('roles:update')) {
        return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 403 })
    }

    const { id } = await params

    try {
        const body = await req.json()
        console.log('[ROLES API] PUT received body:', JSON.stringify(body, null, 2))

        const validated = roleUpdateSchema.parse(body)
        console.log('[ROLES API] Validated data:', JSON.stringify(validated, null, 2))

        // Sanitize permissions based on panel access flags (safety net)
        const sanitizedPermissions = await sanitizePermissionsByPanelAccess(
            validated.permissions,
            validated.accessAdminPanel ?? false,
            validated.accessEmployeePanel ?? false
        )

        const roleService = getRoleService()
        const updateData: {
            name: string;
            permissions: string[];
            description?: string;
            accessAdminPanel?: boolean;
            accessEmployeePanel?: boolean;
            isRestricted?: boolean;
            isTechnical?: boolean;
            isSuperAdmin?: boolean;
        } = {
            name: validated.name,
            permissions: sanitizedPermissions,
        }
        if (validated.description !== undefined) updateData.description = validated.description
        if (validated.accessAdminPanel !== undefined) updateData.accessAdminPanel = validated.accessAdminPanel
        if (validated.accessEmployeePanel !== undefined) updateData.accessEmployeePanel = validated.accessEmployeePanel
        if (validated.isRestricted !== undefined) updateData.isRestricted = validated.isRestricted
        if (validated.isTechnical !== undefined) updateData.isTechnical = validated.isTechnical
        if (validated.isSuperAdmin !== undefined) updateData.isSuperAdmin = validated.isSuperAdmin

        const updatedRole = await roleService.updateRole(id, updateData)

        // Invalidate permission cache for all users with this role
        // This ensures the changes take effect immediately without re-login
        const { invalidateRolePermissionCache } = await import('@/lib/auth')
        await invalidateRolePermissionCache(id)

        // System Log
        logActivitySafe({
            action: 'UPDATE',
            subject: 'Role',
            userId: session.user.id ?? 'unknown',
            details: { id, updates: validated }
        })

        return NextResponse.json(updatedRole)
    } catch (error: unknown) {
        console.error('Error updating role:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues[0]?.message || 'Validasi gagal' }, { status: 400 })
        }
        if (error instanceof Error) {
            if (error.message === 'Role tidak ditemukan') {
                return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 })
            }
            if (error.message === 'Tidak dapat mengubah nama role SUPER_ADMIN') {
                return NextResponse.json({ error: 'Tidak dapat mengubah nama role SUPER_ADMIN' }, { status: 400 })
            }
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: Params) {
    const session = await getServerSession(authOptions)
    if (!session) {
        // DELETE requires auth check for logging mainly, though permission check covers it
        return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    if (!await hasPermission('roles:delete')) {
        return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 403 })
    }

    const { id } = await params

    try {
        const roleService = getRoleService()
        await roleService.deleteRole(id)

        // System Log
        logActivitySafe({
            action: 'DELETE',
            subject: 'Role',
            userId: session.user.id ?? 'unknown',
            details: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        console.error('Error deleting role:', error)
        if (error instanceof Error) {
            if (error.message === 'Role tidak ditemukan') {
                return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 })
            }
            if (error.message === 'Tidak dapat menghapus role SUPER_ADMIN' ||
                error.message === 'Tidak dapat menghapus role yang masih memiliki pengguna') {
                return NextResponse.json({ error: error.message }, { status: 400 })
            }
        }
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
