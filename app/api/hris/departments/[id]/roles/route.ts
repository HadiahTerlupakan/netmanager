import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createRoleSchema = z.object({
    name: z.string().min(1, 'Role name is required'),
    code: z.string().optional(),
    description: z.string().optional(),
    allowedFeatures: z.array(z.string()).optional(),
    priority: z.number().int().min(1).max(100).default(50),
})

// GET /api/hris/departments/[id]/roles - Get all roles for a department
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify department exists
        const department = await prisma.department.findUnique({
            where: { id }
        })

        if (!department) {
            return NextResponse.json({ error: 'Department not found' }, { status: 404 })
        }

        const roles = await prisma.customRole.findMany({
            where: { departmentId: id },
            include: {
                _count: {
                    select: { employeeRoles: true }
                }
            },
            orderBy: [
                { priority: 'desc' },
                { name: 'asc' }
            ]
        })

        return NextResponse.json({ roles })
    } catch (error: any) {
        console.error('Error fetching department roles:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// POST /api/hris/departments/[id]/roles - Create new role for department
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (false) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const body = await req.json()

        // Validate request body
        const validatedData = createRoleSchema.parse(body)

        // Verify department exists
        const department = await prisma.department.findUnique({
            where: { id }
        })

        if (!department) {
            return NextResponse.json({ error: 'Department not found' }, { status: 404 })
        }

        // Generate code if not provided
        if (!validatedData.code) {
            const deptPrefix = department.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 3)
            const roleCount = await prisma.customRole.count({
                where: { departmentId: id }
            })
            validatedData.code = `${deptPrefix}_ROLE_${(roleCount + 1).toString().padStart(2, '0')}`
        }

        // Check if role code already exists in this department
        const existingRole = await prisma.customRole.findFirst({
            where: {
                departmentId: id,
                code: validatedData.code
            }
        })

        if (existingRole) {
            return NextResponse.json({ error: 'Role code already exists in this department' }, { status: 400 })
        }

        // Create role
        const role = await prisma.customRole.create({
            data: {
                name: validatedData.name,
                code: validatedData.code,
                description: validatedData.description,
                priority: validatedData.priority,
                departmentId: id,
                allowedFeatures: validatedData.allowedFeatures ? JSON.stringify(validatedData.allowedFeatures) : null,
                createdBy: session.user.id
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

        // Log the action
        await prisma.roleAuditLog.create({
            data: {
                roleId: role.id,
                entityType: 'ROLE',
                entityId: role.id,
                action: 'CREATE',
                oldValues: {},
                newValues: JSON.stringify(role),
                userId: session.user.id,
                userAgent: req.headers.get('user-agent') || '',
                ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '',
            }
        })

        return NextResponse.json(role, { status: 201 })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
        }
        console.error('Error creating role:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}