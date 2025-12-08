import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEmployeePermissions } from '@/lib/utils/permissions'

/**
 * GET /api/employee/me
 * Get current logged-in employee's information with department and permissions
 */
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Find employee by userId
        const employee = await prisma.employee.findUnique({
            where: { userId: session.user.id },
            include: {
                department: true,
                position: true,
            },
        })

        if (!employee) {
            // If user is ADMIN, allow access with default permissions
            if (session.user.role === 'ADMIN') {
                return NextResponse.json({
                    employee: null,
                    permissions: {
                        employeeId: null,
                        departmentId: null,
                        departmentName: null,
                        allowedFeatures: ['HRIS', 'WORKORDERS', 'INVENTORY'], // Admin has all features
                        role: session.user.role,
                    },
                    user: {
                        id: session.user.id,
                        name: session.user.name,
                        email: session.user.email,
                        role: session.user.role,
                    },
                })
            }

            return NextResponse.json(
                { error: 'Employee profile not found' },
                { status: 404 }
            )
        }

        // Get employee permissions
        const permissions = await getEmployeePermissions(
            employee.employeeId,
            session.user.role
        )

        // Return employee data with permissions
        return NextResponse.json({
            employee: {
                id: employee.id,
                employeeId: employee.employeeId,
                fullName: employee.fullName,
                email: employee.email,
                phone: employee.phone,
                photoUrl: employee.photoUrl,
                departmentId: employee.departmentId,
                departmentName: employee.department?.name || null,
                positionId: employee.positionId,
                positionTitle: employee.position?.title || null,
                employmentStatus: employee.employmentStatus,
                joinDate: employee.joinDate,
                isActive: employee.isActive,
            },
            permissions: permissions || {
                employeeId: employee.employeeId,
                departmentId: null,
                departmentName: null,
                allowedFeatures: [],
                role: session.user.role,
            },
            user: {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                role: session.user.role,
            },
        })
    } catch (error: any) {
        console.error('Error fetching employee data:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
