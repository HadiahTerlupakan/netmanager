import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { RoleRepository } from '@/lib/repositories/RoleRepository'
import { RoleAuditService } from '@/lib/services/RoleAuditService'

const roleRepo = new RoleRepository()
const auditService = new RoleAuditService()

// GET /api/admin/roles - List all custom roles
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Only ADMIN can view roles
        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const departmentId = searchParams.get('departmentId') || undefined
        const isActive = searchParams.get('isActive')
        const search = searchParams.get('search') || undefined

        const roles = await roleRepo.findAll({
            departmentId,
            isActive: isActive !== null ? isActive === 'true' : undefined,
            search,
        })

        return NextResponse.json({
            success: true,
            roles,
            total: roles.length,
        })
    } catch (error: any) {
        console.error('Error fetching roles:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch roles' },
            { status: 500 }
        )
    }
}

// POST /api/admin/roles - Create new custom role
export async function POST(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Only ADMIN can create roles
        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        const body = await req.json()

        // Validation
        if (!body.name) {
            return NextResponse.json({ error: 'Role name is required' }, { status: 400 })
        }

        if (!body.departmentId) {
            return NextResponse.json({ error: 'Department is required' }, { status: 400 })
        }

        if (!body.allowedFeatures || !Array.isArray(body.allowedFeatures)) {
            return NextResponse.json(
                { error: 'Allowed features must be an array' },
                { status: 400 }
            )
        }

        // Create the role
        const role = await roleRepo.create({
            name: body.name,
            code: body.code,
            description: body.description,
            departmentId: body.departmentId,
            allowedFeatures: body.allowedFeatures,
            priority: body.priority,
            createdBy: session.user.id,
        })

        // Log the creation
        await auditService.logRoleCreate(
            role.id,
            {
                name: role.name,
                code: role.code,
                departmentId: role.departmentId,
                allowedFeatures: role.allowedFeatures,
                priority: role.priority,
            },
            session.user.id,
            session.user.name
        )

        return NextResponse.json({
            success: true,
            role,
        }, { status: 201 })
    } catch (error: any) {
        console.error('Error creating role:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to create role' },
            { status: 500 }
        )
    }
}
