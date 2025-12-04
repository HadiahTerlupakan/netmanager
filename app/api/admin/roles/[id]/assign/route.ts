import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { RoleRepository } from '@/lib/repositories/RoleRepository'
import { RoleAuditService } from '@/lib/services/RoleAuditService'

const roleRepo = new RoleRepository()
const auditService = new RoleAuditService()

// POST /api/admin/roles/[id]/assign - Assign role to employee(s)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session: any = await getServerSession(authConfig as any)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        const body = await req.json()
        const roleId = id

        // Support both single employee and multiple employees
        const employeeIds: string[] = Array.isArray(body.employeeIds)
            ? body.employeeIds
            : [body.employeeId]

        if (!employeeIds || employeeIds.length === 0) {
            return NextResponse.json(
                { error: 'Employee ID(s) required' },
                { status: 400 }
            )
        }

        const results = []
        const errors = []

        // Assign role to each employee
        for (const employeeId of employeeIds) {
            try {
                const assignment = await roleRepo.assignToEmployee({
                    employeeId,
                    roleId,
                    assignedBy: session.user.id,
                })

                // Log the assignment
                await auditService.logRoleAssign(
                    assignment.id,
                    roleId,
                    employeeId,
                    session.user.id,
                    session.user.name
                )

                results.push({
                    employeeId,
                    success: true,
                    assignment,
                })
            } catch (error: any) {
                errors.push({
                    employeeId,
                    error: error.message,
                })
            }
        }

        return NextResponse.json({
            success: errors.length === 0,
            results,
            errors: errors.length > 0 ? errors : undefined,
            message: `${results.length} assignment(s) successful, ${errors.length} failed`,
        })
    } catch (error: any) {
        console.error('Error assigning role:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to assign role' },
            { status: 500 }
        )
    }
}

// DELETE /api/admin/roles/[id]/assign - Remove role from employee
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session: any = await getServerSession(authConfig as any)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const employeeId = searchParams.get('employeeId')
        const roleId = id

        if (!employeeId) {
            return NextResponse.json(
                { error: 'Employee ID required' },
                { status: 400 }
            )
        }

        // Get assignment before removing for audit
        const assignments = await roleRepo.getEmployeeRoles(employeeId)
        const assignment = assignments.find(a => a.roleId === roleId)

        if (!assignment) {
            return NextResponse.json(
                { error: 'Role assignment not found' },
                { status: 404 }
            )
        }

        // Remove the assignment
        await roleRepo.unassignFromEmployee(employeeId, roleId)

        // Log the removal
        await auditService.logRoleUnassign(
            assignment.id,
            roleId,
            employeeId,
            session.user.id,
            session.user.name
        )

        return NextResponse.json({
            success: true,
            message: 'Role unassigned successfully',
        })
    } catch (error: any) {
        console.error('Error unassigning role:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to unassign role' },
            { status: 500 }
        )
    }
}
