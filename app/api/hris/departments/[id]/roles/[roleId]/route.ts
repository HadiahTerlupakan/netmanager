import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateRoleSchema = z.object({
    name: z.string().min(1, 'Role name is required').optional(),
    description: z.string().optional(),
    allowedFeatures: z.array(z.string()).optional(),
    priority: z.number().int().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
})

// GET /api/hris/departments/[id]/roles/[roleId] - Get specific role
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; roleId: string }> }
) {
    try {
        const { id, roleId } = await params
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const role = await prisma.customRole.findFirst({
            where: {
                id: roleId,
                departmentId: id
            },
            include: {
                department: {
                    select: { name: true }
                },
                _count: {
                    select: { employeeRoles: true }
                }
            }
        })

        if (!role) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 })
        }

        return NextResponse.json(role)
    } catch (error: any) {
        console.error('Error fetching role:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// PUT /api/hris/departments/[id]/roles/[roleId] - Update role
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; roleId: string }> }
) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (false) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id, roleId } = await params
        const body = await req.json()

        // Validate request body
        const validatedData = updateRoleSchema.parse(body)

        // Check if role exists and belongs to this department
        const existingRole = await prisma.customRole.findFirst({
            where: {
                id: roleId,
                departmentId: id
            }
        })

        if (!existingRole) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 })
        }

        // Store old values for audit
        const oldValues = { ...existingRole }

        // Update role
        const updateData: any = { ...validatedData }
        if (validatedData.allowedFeatures !== undefined) {
            updateData.allowedFeatures = validatedData.allowedFeatures ? JSON.stringify(validatedData.allowedFeatures) : null
        }

        const updatedRole = await prisma.customRole.update({
            where: { id: roleId },
            data: updateData,
            include: {
                department: {
                    select: { name: true }
                },
                _count: {
                    select: { employeeRoles: true }
                }
            }
        })

        // Log the action
        await prisma.roleAuditLog.create({
            data: {
                roleId: roleId,
                entityType: 'ROLE',
                entityId: roleId,
                action: 'UPDATE',
                oldValues: JSON.stringify(oldValues),
                newValues: JSON.stringify(updatedRole),
                userId: session.user.id,
                userAgent: req.headers.get('user-agent') || '',
                ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '',
            }
        })

        return NextResponse.json(updatedRole)
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
        }
        console.error('Error updating role:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/hris/departments/[id]/roles/[roleId] - Delete role
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; roleId: string }> }
) {
    try {
        const { id, roleId } = await params
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (false) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Check if role exists and belongs to this department
        const existingRole = await prisma.customRole.findFirst({
            where: {
                id: roleId,
                departmentId: id
            },
            include: {
                _count: {
                    select: { employeeRoles: true }
                }
            }
        })

        if (!existingRole) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 })
        }

        // Check if role has assignments
        if (existingRole._count.employeeRoles > 0) {
            return NextResponse.json({
                error: 'Cannot delete role with active assignments',
                details: `${existingRole._count.employeeRoles} employee(s) have this role assigned`
            }, { status: 400 })
        }

        // Store old values for audit
        const oldValues = { ...existingRole }

        // Delete role
        await prisma.customRole.delete({
            where: { id: roleId }
        })

        // Log the action
        await prisma.roleAuditLog.create({
            data: {
                roleId: roleId,
                entityType: 'ROLE',
                entityId: roleId,
                action: 'DELETE',
                oldValues: JSON.stringify(oldValues),
                newValues: {},
                userId: session.user.id,
                userAgent: req.headers.get('user-agent') || '',
                ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '',
            }
        })

        return NextResponse.json({ message: 'Role deleted successfully' })
    } catch (error: any) {
        console.error('Error deleting role:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}