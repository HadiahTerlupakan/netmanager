import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { RoleRepository } from '@/lib/repositories/RoleRepository'
import { RoleAuditService } from '@/lib/services/RoleAuditService'

const roleRepo = new RoleRepository()
const auditService = new RoleAuditService()

// GET /api/admin/roles/[id] - Get role details
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session: any = await getServerSession(authConfig as any)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        const role = await roleRepo.findById(params.id)

        if (!role) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            role,
        })
    } catch (error: any) {
        console.error('Error fetching role:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch role' },
            { status: 500 }
        )
    }
}

// PUT /api/admin/roles/[id] - Update role
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session: any = await getServerSession(authConfig as any)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        // Get old role data for audit
        const oldRole = await roleRepo.findById(params.id)
        if (!oldRole) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 })
        }

        const body = await req.json()

        // Update the role
        const updatedRole = await roleRepo.update(params.id, {
            name: body.name,
            description: body.description,
            allowedFeatures: body.allowedFeatures,
            priority: body.priority,
            isActive: body.isActive,
        })

        // Log the update
        await auditService.logRoleUpdate(
            params.id,
            {
                name: oldRole.name,
                description: oldRole.description,
                allowedFeatures: oldRole.allowedFeatures,
                priority: oldRole.priority,
                isActive: oldRole.isActive,
            },
            {
                name: updatedRole.name,
                description: updatedRole.description,
                allowedFeatures: updatedRole.allowedFeatures,
                priority: updatedRole.priority,
                isActive: updatedRole.isActive,
            },
            session.user.id,
            session.user.name
        )

        return NextResponse.json({
            success: true,
            role: updatedRole,
        })
    } catch (error: any) {
        console.error('Error updating role:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to update role' },
            { status: 500 }
        )
    }
}

// PATCH /api/admin/roles/[id] - Partial update
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    return PUT(req, { params })
}

// DELETE /api/admin/roles/[id] - Delete role
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session: any = await getServerSession(authConfig as any)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        // Get role data before deletion for audit
        const role = await roleRepo.findById(params.id)
        if (!role) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 })
        }

        // Delete the role (will fail if there are assignments)
        await roleRepo.delete(params.id)

        // Log the deletion
        await auditService.logRoleDelete(
            params.id,
            {
                name: role.name,
                code: role.code,
                departmentId: role.departmentId,
                allowedFeatures: role.allowedFeatures,
            },
            session.user.id,
            session.user.name
        )

        return NextResponse.json({
            success: true,
            message: 'Role deleted successfully',
        })
    } catch (error: any) {
        console.error('Error deleting role:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to delete role' },
            { status: 500 }
        )
    }
}
